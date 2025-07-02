
import type { HandlerEvent } from '@netlify/functions';
import { OAuth2Client, LoginTicket } from 'google-auth-library';
import { supabase } from '../../services/supabaseClient';

// It's best practice to store these in Netlify environment variables
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
 * Verifies the Google ID token from the Authorization header and checks if the user
 * is authorized to use the application (either as admin or a managed user).
 * Throws an AuthError with a status code and message on failure.
 * @param event The Netlify function handler event.
 * @returns A promise that resolves with the authenticated user's context.
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
  
  // SUPER ADMIN Check (Failsafe)
  if (userEmail === SUPER_ADMIN_EMAIL) {
    try {
      await supabase
        .from('admins')
        .upsert({ email: userEmail, added_by: 'system_bootstrap' }, { onConflict: 'email' });
    } catch (dbError: any) {
      console.error(`Database error during super admin upsert (access will be granted anyway):`, dbError);
    }
    return { email: userEmail, role: 'admin', name: payload.name || 'Super Admin' };
  }

  // REGULAR ADMIN Check
  try {
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('email')
      .eq('email', userEmail)
      .maybeSingle();

    if (adminRecord) {
      return { email: userEmail, role: 'admin', name: payload.name || 'Admin' };
    }
  } catch (dbError: any) {
    console.error('Database error while checking admins table:', dbError);
    throw { statusCode: 500, message: 'Server error during admin verification.' };
  }

  // MANAGER Check
  try {
    const { data: managedUser } = await supabase
      .from('managed_users')
      .select('id, name')
      .eq('email', userEmail)
      .maybeSingle();

    if (managedUser) {
      return { email: userEmail, role: 'manager', name: payload.name || managedUser.name };
    }
  } catch (dbError: any) {
    console.error('Database error while checking managed_users table:', dbError);
    throw { statusCode: 500, message: 'Server error during user verification.' };
  }
  
  // If no role was found, deny access.
  throw { statusCode: 403, message: 'User is not authorized to access this application.' };
};
