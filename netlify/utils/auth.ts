
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
}

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

  // 1. SUPER ADMIN Failsafe Check. This is the highest priority.
  // It returns immediately to guarantee the super admin can always log in,
  // regardless of database status.
  if (userEmail === SUPER_ADMIN_EMAIL) {
    // The database upsert runs in the background (fire-and-forget)
    // so it doesn't block the login process.
    supabase
      .from('admins')
      .upsert({ email: userEmail, added_by: 'system_bootstrap' }, { onConflict: 'email' })
      .then(({ error }) => {
        if (error) {
          console.error(`Non-fatal DB error during background super admin upsert:`, error);
        }
      });
    return { email: userEmail, role: 'admin', name: payload.name || 'Super Admin' };
  }

  // For all other users, perform database checks.
  try {
    // 2. Regular Admin Check
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('email')
      .eq('email', userEmail)
      .maybeSingle();

    if (adminRecord) {
      return { email: userEmail, role: 'admin', name: payload.name || 'Admin' };
    }

    // 3. Manager Check
    const { data: managedUser } = await supabase
      .from('managed_users')
      .select('id, name')
      .eq('email', userEmail)
      .maybeSingle();

    if (managedUser) {
      return { email: userEmail, role: 'manager', name: payload.name || managedUser.name };
    }

    // 4. If no role found, deny access.
    throw { statusCode: 403, message: 'User is not authorized to access this application.' };

  } catch (error: any) {
    // If it's a structured error we threw intentionally (like 403), re-throw it.
    if (error.statusCode) {
      throw error;
    }

    // Otherwise, it's an unexpected database or other server error.
    console.error('Unexpected error during authorization check:', error);
    throw { statusCode: 500, message: 'A server error occurred during user authorization.' };
  }
};
