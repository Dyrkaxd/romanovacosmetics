
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import type { ManagedUser } from '../../types'; // Ensure ManagedUser type aligns with DB

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Basic check if the caller is the admin (crude, for a real app, use JWT auth)
// This is a placeholder and NOT secure for production.
// In a real app, you'd verify a JWT token passed in Authorization header.
const isAdminUser = (event: HandlerEvent): boolean => {
  // This is a simplified check. A robust solution would involve validating
  // a session token or JWT that confirms the user's admin role.
  // For now, we'll assume any request to this function should be from an admin-like context
  // or the AuthContext on the client has already gated access.
  // This function doesn't have enough context to know the current user's role securely.
  // We'll rely on the client-side check for now, which is not ideal for write operations.
  return true; 
};


const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  // Crude security check, not for production. Real auth needed.
  // if (!isAdminUser(event)) {
  //   return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Admin access required.' })};
  // }
  
  const pathParts = event.path.split('/').filter(Boolean);
  const resourceId = pathParts.length > 2 ? pathParts[2] : null; // e.g. /api/managed-users/USER_ID

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (resourceId) {
          const { data, error } = await supabase
            .from('managed_users')
            .select('*')
            .eq('id', resourceId)
            .single();
          if (error) throw error;
          if (!data) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Managed user not found' }) };
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data) };
        } else {
          // Check for email query parameter for AuthContext
          const emailToQuery = event.queryStringParameters?.email;
          if (emailToQuery) {
             const { data, error } = await supabase
              .from('managed_users')
              .select('id, name, email, notes, created_at, added_by_admin_email')
              .eq('email', emailToQuery.toLowerCase())
              .maybeSingle(); // Use maybeSingle as user might not exist
            if (error) throw error;
            return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data) }; // Will be null if not found
          }

          // Get all managed users
          const { data, error } = await supabase
            .from('managed_users')
            .select('id, name, email, notes, created_at, added_by_admin_email') // Explicitly select columns
            .order('created_at', { ascending: false });
          if (error) throw error;
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data) };
        }

      case 'POST':
        const newManagerData = JSON.parse(event.body || '{}') as Omit<ManagedUser, 'id' | 'dateAdded'> & { added_by_admin_email?: string };
        if (!newManagerData.name || !newManagerData.email) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Name and email are required.' })};
        }
        const { data: createdManager, error: createError } = await supabase
          .from('managed_users')
          .insert({
            name: newManagerData.name,
            email: newManagerData.email.toLowerCase(),
            notes: newManagerData.notes,
            added_by_admin_email: newManagerData.added_by_admin_email 
          })
          .select()
          .single();
        if (createError) throw createError;
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(createdManager) };

      case 'PUT':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Manager ID required for update' }) };
        const updatedManagerData = JSON.parse(event.body || '{}') as Partial<ManagedUser>;
        
        // Prepare data for update, excluding fields that shouldn't be changed here like id, email, dateAdded (derived from created_at)
        const { id, email, dateAdded, ...dataToUpdate } = updatedManagerData;
        
        const { data: updatedManager, error: updateError } = await supabase
          .from('managed_users')
          .update(dataToUpdate) // 'notes' and 'name' are in dataToUpdate if present in updatedManagerData
          .eq('id', resourceId)
          .select()
          .single();
        if (updateError) throw updateError;
        if (!updatedManager) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Managed user not found or failed to update' })};
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(updatedManager) };

      case 'DELETE':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Manager ID required for delete' }) };
        const { error: deleteError } = await supabase
          .from('managed_users')
          .delete()
          .eq('id', resourceId);
        if (deleteError) throw deleteError;
        return { statusCode: 204, headers: commonHeaders, body: '' };

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    console.error('Supabase error (managedUsers):', error);
    const statusCode = error.code && typeof error.code === 'string' && error.code.startsWith('PGRST') ? 400 : 500;
    return {
      statusCode,
      headers: commonHeaders,
      body: JSON.stringify({ message: error.message, details: error.details, hint: error.hint }),
    };
  }
};

export { handler };