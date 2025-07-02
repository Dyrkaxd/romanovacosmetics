import type { HandlerEvent } from '@netlify/functions';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../../services/supabaseClient';

// It's best practice to store these in Netlify environment variables
const GOOGLE_CLIENT_ID = "207911989595-0d5jo71ibh1q3rr6qg9gdai9j8v8b75i.apps.googleusercontent.com";

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

    // Special case: Ensure the default admin user 'samsonenkoroma@gmail.com' always has admin access.
    // This prevents accidental lockout and serves as a bootstrap mechanism.
    if (userEmail === 'samsonenkoroma@gmail.com') {
      // Use upsert to ensure the user exists in the admins table without causing errors if they already do.
      const { error } = await supabase
        .from('admins')
        .upsert({ email: userEmail, added_by: 'system_bootstrap' }, { onConflict: 'email' });

      if (error) {
        console.error(`Could not upsert default admin '${userEmail}', but granting access anyway. Error:`, error);
      }
      return { email: userEmail, role: 'admin', name: payload.name || 'Default Admin' };
    }


    // For all other users, follow the standard authorization flow.
    // 1. Check if they are an admin.
    const { data: adminRecord, error: adminCheckError } = await supabase
      .from('admins')
      .select('email')
      .eq('email', userEmail)
      .single();

    if (adminCheckError && adminCheckError.code !== 'PGRST116') { // Ignore "no rows found"
        console.error('Supabase error checking admins table:', adminCheckError);
        throw { statusCode: 500, message: 'Database error while verifying admin status' } as AuthError;
    }
    
    if (adminRecord) {
      return { email: userEmail, role: 'admin', name: payload.name || 'Admin' };
    }

    // 2. If not an admin, check if they are a managed user.
    const { data: managedUser, error: managerCheckError } = await supabase
      .from('managed_users')
      .select('id, name')
      .eq('email', userEmail)
      .single();

    if (managerCheckError && managerCheckError.code !== 'PGRST116') { // Ignore "no rows found"
      console.error('Supabase error checking managed user:', managerCheckError);
      throw { statusCode: 500, message: 'Database error while verifying user permissions' } as AuthError;
    }

    if (managedUser) {
      return { email: userEmail, role: 'manager', name: payload.name || managedUser.name };
    }

    // 3. If the user is neither, they are forbidden.
    throw { statusCode: 403, message: 'User is not authorized to access this resource' } as AuthError;

  } catch (err: any) {
    // Re-throw our custom AuthError if it's already one of ours
    if (err.statusCode) {
        throw err;
    }
    // Otherwise, it's likely a token verification error from google-auth-library
    console.error('Token verification failed:', err.message);
    throw { statusCode: 401, message: 'Token is invalid or has expired' } as AuthError;
  }
};
