import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; // Adjusted path

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
  const resourceId = pathParts.length > 2 ? pathParts[2] : null;

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (resourceId) {
          const { data, error } = await supabase.from('customers').select('*').eq('id', resourceId).single();
          if (error) throw error;
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data) };
        } else {
          const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
          if (error) throw error;
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data) };
        }

      case 'POST':
        const newCustomerData = JSON.parse(event.body || '{}');
        // Transform nested address to flat columns for Supabase, if your schema is flat
        const { address, ...restOfCustomerData } = newCustomerData;
        const customerToInsert = {
            ...restOfCustomerData,
            address_street: address?.street,
            address_city: address?.city,
            address_state: address?.state,
            address_zip: address?.zip,
            address_country: address?.country,
        };
        const { data: createdData, error: createError } = await supabase.from('customers').insert(customerToInsert).select().single();
        if (createError) throw createError;
        // Transform flat address columns back to nested object for response consistency with Product type
        const { address_street, address_city, address_state, address_zip, address_country, ...customerResponse } = createdData;
        const responseWithNestedAddress = {
          ...customerResponse,
          address: {
            street: address_street,
            city: address_city,
            state: address_state,
            zip: address_zip,
            country: address_country,
          }
        };
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(responseWithNestedAddress) };

      case 'PUT':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Customer ID required' }) };
        const updatedCustomerData = JSON.parse(event.body || '{}');
        const { address: updatedAddress, ...restOfUpdatedCustomerData } = updatedCustomerData;
        const customerToUpdate = {
            ...restOfUpdatedCustomerData,
            address_street: updatedAddress?.street,
            address_city: updatedAddress?.city,
            address_state: updatedAddress?.state,
            address_zip: updatedAddress?.zip,
            address_country: updatedAddress?.country,
        };
        delete customerToUpdate.id; // ID should not be updated

        const { data: updatedData, error: updateError } = await supabase.from('customers').update(customerToUpdate).eq('id', resourceId).select().single();
        if (updateError) throw updateError;
         const { address_street: ua_street, address_city: ua_city, address_state: ua_state, address_zip: ua_zip, address_country: ua_country, ...updatedCustomerResponse } = updatedData;
        const updatedResponseWithNestedAddress = {
          ...updatedCustomerResponse,
          address: {
            street: ua_street,
            city: ua_city,
            state: ua_state,
            zip: ua_zip,
            country: ua_country,
          }
        };
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(updatedResponseWithNestedAddress) };

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
    return {
      statusCode: error.code && typeof error.code === 'string' && error.code.startsWith('PGRST') ? 400 : 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: error.message, details: error.details, hint: error.hint }),
    };
  }
};

export { handler };
