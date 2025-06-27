
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../services/supabaseClient'; 
import type { Customer } from '../../types'; // For the final shape
import type { Database } from '../../types/supabase'; // For DB row type

type CustomerDbRow = Database['public']['Tables']['customers']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Helper function to transform DB row to client-side Customer type
const transformDbRowToCustomer = (dbCustomer: CustomerDbRow): Customer => {
  return {
    id: dbCustomer.id,
    name: dbCustomer.name,
    email: dbCustomer.email,
    phone: dbCustomer.phone || '', // Handle null phone
    address: {
      street: dbCustomer.address_street || '',
      city: dbCustomer.address_city || '',
      state: dbCustomer.address_state || '',
      zip: dbCustomer.address_zip || '',
      country: dbCustomer.address_country || '',
    },
    joinDate: dbCustomer.join_date, 
    instagramHandle: dbCustomer.instagram_handle || undefined,
    viberNumber: dbCustomer.viber_number || undefined,
    created_at: dbCustomer.created_at || undefined,
  };
};


const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  const pathParts = event.path.split('/').filter(Boolean);
  const resourceId = pathParts.length > 2 ? pathParts[2] : null;

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (resourceId) {
          const { data: dbData, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', resourceId)
            .single();
          if (error) throw error;
          if (!dbData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Customer not found'}) };
          
          const customer = transformDbRowToCustomer(dbData as CustomerDbRow);
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(customer) };
        } else {
          const { data: dbData, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;

          const customers = (dbData as CustomerDbRow[] || []).map(transformDbRowToCustomer);
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(customers) };
        }

      case 'POST':
        const newCustomerClientData = JSON.parse(event.body || '{}');
        const { address, joinDate, instagramHandle, viberNumber, ...restOfCustomerData } = newCustomerClientData;
        const customerToInsert = {
            ...restOfCustomerData,
            join_date: joinDate, 
            instagram_handle: instagramHandle || null,
            viber_number: viberNumber || null,
            address_street: address?.street || null,
            address_city: address?.city || null,
            address_state: address?.state || null,
            address_zip: address?.zip || null,
            address_country: address?.country || null,
        };
        const { data: createdDbData, error: createError } = await supabase.from('customers').insert(customerToInsert).select().single();
        if (createError) throw createError;
        
        const createdCustomer = transformDbRowToCustomer(createdDbData as CustomerDbRow);
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(createdCustomer) };

      case 'PUT':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Customer ID required' }) };
        const updatedCustomerClientData = JSON.parse(event.body || '{}');
        const { address: updatedAddress, joinDate: updatedJoinDate, instagramHandle: updatedInstagram, viberNumber: updatedViber, ...restOfUpdatedCustomerData } = updatedCustomerClientData;
        const customerToUpdate = {
            ...restOfUpdatedCustomerData,
            join_date: updatedJoinDate, 
            instagram_handle: updatedInstagram || null,
            viber_number: updatedViber || null,
            address_street: updatedAddress?.street || null,
            address_city: updatedAddress?.city || null,
            address_state: updatedAddress?.state || null,
            address_zip: updatedAddress?.zip || null,
            address_country: updatedAddress?.country || null,
        };
        delete customerToUpdate.id; 

        const { data: updatedDbData, error: updateError } = await supabase.from('customers').update(customerToUpdate).eq('id', resourceId).select().single();
        if (updateError) throw updateError;
        if (!updatedDbData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Customer not found or failed to update' })};

        const updatedCustomer = transformDbRowToCustomer(updatedDbData as CustomerDbRow);
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(updatedCustomer) };

      case 'DELETE':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Customer ID required' }) };
        const { error: deleteError } = await supabase.from('customers').delete().eq('id', resourceId);
        if (deleteError) throw deleteError;
        return { statusCode: 204, headers: commonHeaders, body: '' };

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    console.error('Error in netlify/functions/customers.ts:', error);
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