

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; 
import type { ManagedUser } from '../../types';
import type { Database } from '../../types/supabase';

type ManagedUserDbRow = Database['public']['Tables']['managed_users']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Helper function to transform DB row to client-side ManagedUser type
const transformDbRowToManagedUser = (dbUser: ManagedUserDbRow): ManagedUser => {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    notes: dbUser.notes || undefined,
    dateAdded: dbUser.created_at, // Map created_at to dateAdded
    // added_by_admin_email is not directly part of ManagedUser type for client, but useful in DB
  };
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  const pathParts = event.path.split('/').filter(Boolean);
  const resourceId = pathParts.length > 2 ? pathParts[2] : null;
  const emailQuery = event.queryStringParameters?.email;

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (emailQuery) {
          // Get specific manager by email (for auth check)
          const { data, error } = await supabase
            .from('managed_users')
            .select('*')
            .eq('email', emailQuery.toLowerCase())
            .single();
          if (error && error.code !== 'PGRST116') { // PGRST116: " relazione «managed_users» non contiene righe" (no rows found)
             throw error;
          }
          if (!data) return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(null) }; // Return null if not found, not an error for this case
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToManagedUser(data as ManagedUserDbRow)) };

        } else if (resourceId) {
           // Get single manager by ID (less common, but for completeness)
          const { data, error } = await supabase
            .from('managed_users')
            .select('*')
            .eq('id', resourceId)
            .single();
          if (error) throw error;
          if (!data) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Managed user not found'}) };
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToManagedUser(data as ManagedUserDbRow)) };
        } else {
          // Get all managed users
          const { data, error } = await supabase
            .from('managed_users')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const users = (data as ManagedUserDbRow[] || []).map(transformDbRowToManagedUser);
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(users) };
        }

      case 'POST':
        const newManagerData = JSON.parse(event.body || '{}');
        // Client sends `name`, `email`, `notes`, `added_by_admin_email` which map directly to DB columns.
        // `id` and `created_at` are DB generated.
        const { data: createdData, error: createError } = await supabase
          .from('managed_users')
          .insert({
              name: newManagerData.name,
              email: newManagerData.email.toLowerCase(), // Store email in lowercase
              notes: newManagerData.notes,
              added_by_admin_email: newManagerData.added_by_admin_email
          })
          .select()
          .single();
        if (createError) throw createError;
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(transformDbRowToManagedUser(createdData as ManagedUserDbRow)) };

      case 'PUT':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Manager ID required' }) };
        const updatedManagerData = JSON.parse(event.body || '{}');
        // Only allow updating name and notes. Email should not be updatable.
        const dataToUpdate: Partial<ManagedUserDbRow> = {};
        if (updatedManagerData.name !== undefined) dataToUpdate.name = updatedManagerData.name;
        if (updatedManagerData.notes !== undefined) dataToUpdate.notes = updatedManagerData.notes;
        
        if (Object.keys(dataToUpdate).length === 0) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'No fields provided for update' }) };
        }

        const { data: updatedData, error: updateError } = await supabase
          .from('managed_users')
          .update(dataToUpdate)
          .eq('id', resourceId)
          .select()
          .single();
        if (updateError) throw updateError;
        if (!updatedData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Manager not found or failed to update' })};
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToManagedUser(updatedData as ManagedUserDbRow)) };

      case 'DELETE':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Manager ID required' }) };
        const { error: deleteError } = await supabase.from('managed_users').delete().eq('id', resourceId);
        if (deleteError) throw deleteError;
        return { statusCode: 204, headers: commonHeaders, body: '' }; // No content

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    console.error('Error in netlify/functions/managedUsers.ts:', error);
    let message = typeof error.message === 'string' ? error.message : 'An unexpected error occurred.';
    const details = typeof error.details === 'string' ? error.details : undefined;
    const hint = typeof error.hint === 'string' ? error.hint : undefined;
    
    let statusCode = 500;
    if (error && error.code && typeof error.code === 'string') {
        if (error.code.startsWith('PGRST')) { // PostgREST errors
          statusCode = 400; 
          if (error.code === '23505') { // Unique violation
            message = 'A user with this email already exists.';
          }
        }
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
