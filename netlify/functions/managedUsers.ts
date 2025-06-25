
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import type { ManagedUser } from '../../types'; // Ensure ManagedUser type aligns with DB

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }
  
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
          const emailToQuery = event.queryStringParameters?.email;
          if (emailToQuery) {
             const { data, error } = await supabase
              .from('managed_users')
              .select('id, name, email, notes, created_at, added_by_admin_email')
              .eq('email', emailToQuery.toLowerCase())
              .maybeSingle(); 
            if (error) throw error;
            return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data) };
          }

          const { data, error } = await supabase
            .from('managed_users')
            .select('id, name, email, notes, created_at, added_by_admin_email') 
            .order('created_at', { ascending: false });
          if (error) throw error;
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data || []) };
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
        const updatedManagerClientData = JSON.parse(event.body || '{}') as Partial<ManagedUser>;
        
        const { id, email, dateAdded, ...dataToUpdate } = updatedManagerClientData;
        
        const { data: updatedManager, error: updateError } = await supabase
          .from('managed_users')
          .update(dataToUpdate) 
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
    console.error('Error in netlify/functions/managedUsers.ts:', error);
    const message = typeof error.message === 'string' ? error.message : 'An unexpected error occurred.';
    const details = typeof error.details === 'string' ? error.details : undefined;
    const hint = typeof error.hint === 'string' ? error.hint : undefined;

    let statusCode = 500;
    if (error && error.code && typeof error.code === 'string' && error.code.startsWith('PGRST')) {
      statusCode = 400;
    } else if (error && typeof error.status === 'number') {
      statusCode = error.status;
    }
        
    return {
      statusCode,
      headers: commonHeaders,
      body: JSON.stringify({ message, ...(details && { details }), ...(hint && { hint }) }),
    };
  }
};

export { handler };
