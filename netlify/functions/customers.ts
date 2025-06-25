
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; 
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
    joinDate: dbCustomer.join_date, // Map snake_case to camelCase
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
        // POST already transforms the address for insertion and reshapes the response.
        // Ensure join_date is correctly handled if it comes from client as joinDate.
        const newCustomerClientData = JSON.parse(event.body || '{}');
        const { address, joinDate, ...restOfCustomerData } = newCustomerClientData;
        const customerToInsert = {
            ...restOfCustomerData,
            join_date: joinDate, // Ensure field name matches DB
            address_street: address?.street,
            address_city: address?.city,
            address_state: address?.state,
            address_zip: address?.zip,
            address_country: address?.country,
        };
        const { data: createdDbData, error: createError } = await supabase.from('customers').insert(customerToInsert).select().single();
        if (createError) throw createError;
        
        const createdCustomer = transformDbRowToCustomer(createdDbData as CustomerDbRow);
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(createdCustomer) };

      case 'PUT':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Customer ID required' }) };
        // PUT also transforms address for update and reshapes the response.
        // Ensure join_date is correctly handled.
        const updatedCustomerClientData = JSON.parse(event.body || '{}');
        const { address: updatedAddress, joinDate: updatedJoinDate, ...restOfUpdatedCustomerData } = updatedCustomerClientData;
        const customerToUpdate = {
            ...restOfUpdatedCustomerData,
            join_date: updatedJoinDate, // Ensure field name matches DB
            address_street: updatedAddress?.street,
            address_city: updatedAddress?.city,
            address_state: updatedAddress?.state,
            address_zip: updatedAddress?.zip,
            address_country: updatedAddress?.country,
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
    console.error('Supabase error (customers):', error);
    let errorMessage = 'An unexpected error occurred while processing your request.';
    let errorDetails = null;
    let errorHint = null;
    let responseStatusCode = 500;

    if (error && typeof error.message === 'string') {
      errorMessage = error.message;
    }
    // Ensure details and hint are strings or null before stringifying
    if (error && typeof error.details === 'string') {
      errorDetails = error.details;
    }
    if (error && typeof error.hint === 'string') {
      errorHint = error.hint;
    }

    if (error && error.code && typeof error.code === 'string' && error.code.startsWith('PGRST')) {
      responseStatusCode = 400; // Bad Request from PostgREST
    } else if (error && typeof error.status === 'number') {
        responseStatusCode = error.status;
    } else if (error && typeof error.statusCode === 'number') { // some libraries use statusCode
        responseStatusCode = error.statusCode;
    }


    return {
      statusCode: responseStatusCode,
      headers: commonHeaders,
      body: JSON.stringify({
        message: errorMessage,
        ...(errorDetails && { details: errorDetails }),
        ...(errorHint && { hint: errorHint }),
      }),
    };
  }
};

export { handler };
