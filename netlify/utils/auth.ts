

import type { HandlerEvent } from '@netlify/functions';
import { OAuth2Client, LoginTicket } from 'google-auth-library';
import { supabase } from '../../services/supabaseClient';

const GOOGLE_CLIENT_ID = "207911989595-0d5jo71ibh1q3rr6qg9gdai9j8v8b75i.apps.googleusercontent.com";
const SUPER_ADMIN_EMAIL = 'samsonenkoroma@gmail.com';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface AuthError {
  statusCode: number;
  message: string;
}

export interface AuthenticatedUser {
  email: string;
  role: 'admin' | 'manager';
  name?: string;
  canAccessWarehouse?: boolean;
}

/**
 * Checks if a Supabase error indicates a missing table.
 * @param error The error object from a Supabase client call.
 * @returns True if the error is a 'relation does not exist' error.
 */
export const isMissingTableError = (error: any): boolean => {
  const msg = error?.message?.toLowerCase() || '';
  // PGRST116 is 'relation does not exist' via PostgREST, 42P01 is via direct PG.
  return error?.code === '42P01' || error?.code === 'PGRST116' || (msg.includes('relation') && msg.includes('does not exist'));
};


/**
 * Verifies the Google ID token and authorizes the user against the database.
 * Throws a structured AuthError on failure.
 * @param event The Netlify function handler event.
 * @returns A promise resolving to the authenticated user's context.
 */
export const requireAuth = async (event: HandlerEvent): Promise<AuthenticatedUser> => {
  const { authorization } = event.headers;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw { statusCode: 401, message: 'Missing or invalid authorization token' };
  }

  const token = authorization.substring(7);
  let payload: any;

  try {
    const ticket: LoginTicket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Invalid token payload');
    }
  } catch (err: any) {
    console.error('Token verification failed:', err.message);
    throw { statusCode: 401, message: 'Token is invalid or has expired' };
  }
  
  const userEmail = payload.email.toLowerCase();

  // 1. SUPER ADMIN Failsafe Check.
  if (userEmail === SUPER_ADMIN_EMAIL) {
    supabase
      .from('admins')
      .upsert({ email: userEmail, added_by: 'system_bootstrap' }, { onConflict: 'email' })
      .then(({ error }) => {
        if (error) {
          if (isMissingTableError(error)) {
            console.warn(`Database setup warning: 'admins' table is missing. Could not bootstrap super admin. This is safe to ignore if the table will be created later.`);
          } else {
            console.error(`Non-fatal DB error during background super admin upsert:`, error);
          }
        }
      });
    return { email: userEmail, role: 'admin', name: payload.name || 'Super Admin', canAccessWarehouse: true };
  }

  // For all other users, perform database checks.
  try {
    // 2. Regular Admin Check
    const { data: adminRecord, error: adminError } = await supabase
      .from('admins')
      .select('email')
      .eq('email', userEmail)
      .maybeSingle();

    if (adminError && !isMissingTableError(adminError)) {
        throw adminError; // A real error occurred, throw it.
    }
    if (adminRecord) {
      return { email: userEmail, role: 'admin', name: payload.name || 'Admin', canAccessWarehouse: true };
    }

    // 3. Manager Check
    const { data: managedUser, error: managerError } = await supabase
      .from('managed_users')
      .select('id, name, can_access_warehouse')
      .eq('email', userEmail)
      .maybeSingle();

    if (managerError && !isMissingTableError(managerError)) {
      throw managerError; // A real error occurred, throw it.
    }
    if (managedUser) {
      return { email: userEmail, role: 'manager', name: payload.name || managedUser.name, canAccessWarehouse: managedUser.can_access_warehouse ?? false };
    }

    // 4. If no role found, deny access.
    throw { statusCode: 403, message: 'User is not authorized to access this application.' };

  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Unexpected error during authorization check:', error);
    throw { statusCode: 500, message: 'A server error occurred during user authorization.' };
  }
};