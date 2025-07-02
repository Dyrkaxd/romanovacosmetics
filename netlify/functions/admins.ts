
import { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; 
import { requireAuth, AuthenticatedUser, isMissingTableError } from '../utils/auth';
import type { Database } from '../../types/supabase';

type AdminDbRow = Database['public']['Tables']['admins']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handleAdminOnlyRequest = async (user: AuthenticatedUser, logic: () => Promise<any>) => {
  if (user.role !== 'admin') {
    return {
      statusCode: 403,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'Forbidden: This action requires administrator privileges.' }),
    };
  }
  return logic();
};

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const user = await requireAuth(event);
    
    return await handleAdminOnlyRequest(user, async () => {
      switch (event.httpMethod) {
        case 'GET': {
          const { data, error } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
          if (error && isMissingTableError(error)) {
             console.warn('`admins` table not found. Returning empty list. This may indicate a database setup issue.');
             return { statusCode: 200, headers: commonHeaders, body: JSON.stringify([]) };
          }
          if (error) throw error;
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data || []) };
        }

        case 'POST': {
          const { email } = JSON.parse(event.body || '{}');
          if (!email || !/\S+@\S+\.\S+/.test(email)) {
              return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Valid email is required.' }) };
          }
          const { data, error } = await supabase.from('admins').insert({
            email: email.toLowerCase(),
            added_by: user.email,
          }).select().single();

          if (error) {
            if (error.code === '23505') { // unique_violation
                return { statusCode: 409, headers: commonHeaders, body: JSON.stringify({ message: 'An admin with this email already exists.' }) };
            }
            throw error;
          }
          return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(data) };
        }

        case 'DELETE': {
          const { email } = JSON.parse(event.body || '{}');
          if (!email) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Admin email is required for deletion.' }) };
          }
          if (email.toLowerCase() === user.email.toLowerCase()) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'You cannot remove your own admin privileges.' }) };
          }

          const { error } = await supabase.from('admins').delete().eq('email', email.toLowerCase());
          if (error) throw error;
          return { statusCode: 204, headers: commonHeaders, body: '' };
        }

        default:
          return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
      }
    });
  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    
    if (isMissingTableError(error)) {
      const message = `Database setup error: The 'admins' table appears to be missing. Please run the setup SQL script in your Supabase dashboard.`;
      console.error(message, error);
      return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message }) };
    }

    console.error('Error in netlify/functions/admins.ts:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'An unexpected server error occurred.', details: error.message }),
    };
  }
};

export { handler };