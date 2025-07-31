



import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; 
import type { ManagedUser } from '../../types';
import type { Database } from '../../types/supabase';
import { requireAuth, AuthError, AuthenticatedUser, isMissingTableError } from '../utils/auth';

type ManagedUserDbRow = Database['public']['Tables']['managed_users']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const transformDbRowToManagedUser = (dbUser: ManagedUserDbRow): ManagedUser => {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    notes: dbUser.notes || undefined,
    dateAdded: dbUser.created_at,
  };
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

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const user = await requireAuth(event);
    const pathParts = event.path.split('/').filter(Boolean);
    const resourceId = pathParts.length > 2 ? pathParts[2] : null;

    switch (event.httpMethod) {
      case 'GET': {
        const emailQuery = event.queryStringParameters?.email;
        if (emailQuery) {
          // This path is for checking a user's role on login, not admin-gated
          const { data, error } = await supabase.from('managed_users').select('*').eq('email', emailQuery.toLowerCase()).single();
          if (error && error.code !== 'PGRST116' && !isMissingTableError(error)) throw error; // Ignore "no rows found" and missing table
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data ? transformDbRowToManagedUser(data) : null) };
        } else {
          // List all users for filter dropdowns. Allowed for any authenticated user.
          const { data, error } = await supabase.from('managed_users').select('*').order('created_at', { ascending: false });
          if (error && isMissingTableError(error)) {
            console.warn('`managed_users` table not found. Returning empty list. This may indicate a database setup issue.');
            return { statusCode: 200, headers: commonHeaders, body: JSON.stringify([]) };
          }
          if (error) throw error;
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify((data || []).map(transformDbRowToManagedUser)) };
        }
      }

      case 'POST': {
        return handleAdminOnlyRequest(user, async () => {
          const newManagerData = JSON.parse(event.body || '{}');
          const { data, error } = await supabase.from('managed_users').insert({
            name: newManagerData.name,
            email: newManagerData.email.toLowerCase(),
            notes: newManagerData.notes,
            added_by_admin_email: user.email
          }).select().single();
          if (error) throw error;
          return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(transformDbRowToManagedUser(data)) };
        });
      }

      case 'PUT': {
        return handleAdminOnlyRequest(user, async () => {
          if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Manager ID required' }) };
          const updatedManagerData = JSON.parse(event.body || '{}');
          const dataToUpdate: Partial<ManagedUserDbRow> = {};
          if (updatedManagerData.name !== undefined) dataToUpdate.name = updatedManagerData.name;
          if (updatedManagerData.notes !== undefined) dataToUpdate.notes = updatedManagerData.notes;
          
          if (Object.keys(dataToUpdate).length === 0) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'No fields provided for update' }) };

          const { data, error } = await supabase.from('managed_users').update(dataToUpdate).eq('id', resourceId).select().single();
          if (error) throw error;
          if (!data) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Manager not found or failed to update' })};
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToManagedUser(data)) };
        });
      }

      case 'DELETE': {
        return handleAdminOnlyRequest(user, async () => {
          if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Manager ID required' }) };
          const { error } = await supabase.from('managed_users').delete().eq('id', resourceId);
          if (error) throw error;
          return { statusCode: 204, headers: commonHeaders, body: '' };
        });
      }

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    
    if (isMissingTableError(error)) {
      const message = `Database setup error: The 'managed_users' table appears to be missing. Please run the setup SQL script in your Supabase dashboard.`;
      console.error(message, error);
      return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message }) };
    }

    console.error('Error in netlify/functions/managedUsers.ts:', error);
    let message = 'An unexpected error occurred.';
    if (error.code === '23505') message = 'A user with this email already exists.';
    else if (error.message) message = error.message;

    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message, details: error.details, hint: error.hint }) };
  }
};
export { handler };