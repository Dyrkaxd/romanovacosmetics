import type { HandlerEvent } from '@netlify/functions';
import { OAuth2Client } from 'google-auth-library';
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
    throw { statusCode: 401, message: 'Missing or invalid authorization token' } as AuthError;
  }

  const token = authorization.substring(7);

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw { statusCode: 401, message: 'Invalid token payload' } as AuthError;
    }

    const userEmail = payload.email.toLowerCase();

    // Step 1: Check for the failsafe Super Admin first. This is the highest priority.
    if (userEmail === SUPER_ADMIN_EMAIL) {
      // We ensure the super admin's record exists in the DB to prevent lockout issues
      // and for consistency in user lists, etc.
      const { error: upsertError } = await supabase
        .from('admins')
        .upsert({ email: userEmail, added_by: 'system_bootstrap' }, { onConflict: 'email' });
      if (upsertError) {
        // Log the error but still grant access, this is the failsafe account.
        console.error(`Could not upsert default admin '${userEmail}', but granting access anyway. Error:`, upsertError);
      }
      return { email: userEmail, role: 'admin', name: payload.name || 'Admin' };
    }

    // Step 2: If not the super admin, check if they are another admin in the database.
    const { data: adminRecord, error: adminCheckError } = await supabase
      .from('admins')
      .select('email')
      .eq('email', userEmail)
      .single();

    if (adminCheckError && adminCheckError.code !== 'PGRST116') { // Ignore "no rows found" error
        console.error('Supabase error checking admins table:', adminCheckError);
        throw { statusCode: 500, message: 'Database error while verifying admin status' } as AuthError;
    }

    if (adminRecord) {
        return { email: userEmail, role: 'admin', name: payload.name || 'Admin' };
    }

    // Step 3: If not any kind of admin, check if they are a managed user.
    const { data: managedUser, error: managerCheckError } = await supabase
      .from('managed_users')
      .select('id, name')
      .eq('email', userEmail)
      .single();

    if (managerCheckError && managerCheckError.code !== 'PGRST116') { // Ignore "no rows found" error
      console.error('Supabase error checking managed user:', managerCheckError);
      throw { statusCode: 500, message: 'Database error while verifying user permissions' } as AuthError;
    }

    if (managedUser) {
      return { email: userEmail, role: 'manager', name: payload.name || managedUser.name };
    }

    // Step 4: If the user is none of the above, they are not authorized.
    throw { statusCode: 403, message: 'User is not authorized to access this resource' } as AuthError;

  } catch (err: any) {
    // Re-throw our custom AuthError if it's one we created
    if (err.statusCode) {
        throw err;
    }
    // Otherwise, it's likely a token verification error from google-auth-library
    console.error('Token verification failed:', err.message);
    throw { statusCode: 401, message: 'Token is invalid or has expired' } as AuthError;
  }
};
