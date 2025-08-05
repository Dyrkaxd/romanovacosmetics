

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; 
import type { Customer, PaginatedResponse } from '../../types';
import type { Database } from '../../types/supabase';
import { requireAuth, AuthError } from '../utils/auth';

type CustomerDbRow = Database['public']['Tables']['customers']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const transformDbRowToCustomer = (dbCustomer: CustomerDbRow): Customer => {
  return {
    id: dbCustomer.id,
    name: dbCustomer.name,
    email: dbCustomer.email,
    phone: dbCustomer.phone || '',
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
    notes: dbCustomer.notes || undefined,
    created_at: dbCustomer.created_at || undefined,
  };
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
          const { search = '', page = '1', pageSize = '20', sort = 'default' } = event.queryStringParameters || {};
          const currentPage = parseInt(page, 10);
          const size = parseInt(pageSize, 10);
          const from = (currentPage - 1) * size;
          const to = from + size - 1;

          let customerData: CustomerDbRow[] = [];
          let totalCount = 0;

          if (sort === 'vip' || sort === 'inactive') {
              const { data: allOrders, error: ordersError } = await supabase.from('orders').select('customer_id, total_amount, date');
              if (ordersError) throw ordersError;

              const customerMetrics: { [key: string]: { totalSpent: number; lastOrder: string } } = {};
              for (const order of allOrders || []) {
                  if (order.customer_id) { // FIX: Ensure customer_id is not null
                    if (!customerMetrics[order.customer_id]) {
                        customerMetrics[order.customer_id] = { totalSpent: 0, lastOrder: '1970-01-01' };
                    }
                    customerMetrics[order.customer_id].totalSpent += order.total_amount;
                    if (order.date > customerMetrics[order.customer_id].lastOrder) {
                        customerMetrics[order.customer_id].lastOrder = order.date;
                    }
                  }
              }
              
              let rankedCustomerIds: string[] = [];
              if (sort === 'vip') {
                  rankedCustomerIds = Object.keys(customerMetrics).sort((a, b) => customerMetrics[b].totalSpent - customerMetrics[a].totalSpent);
              } else { // inactive
                  const ninetyDaysAgo = new Date();
                  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                  
                  const inactiveWithOrdersIds = Object.keys(customerMetrics).filter(id => new Date(customerMetrics[id].lastOrder) < ninetyDaysAgo);
                  
                  const { data: allCustomers, error: customersError } = await supabase.from('customers').select('id');
                  if (customersError) throw customersError;

                  const customersWithOrders = new Set(Object.keys(customerMetrics));
                  const customersWithNoOrders = (allCustomers || []).filter(c => !customersWithOrders.has(c.id)).map(c => c.id);
                  
                  const allInactiveIds = [...inactiveWithOrdersIds, ...customersWithNoOrders];
                  rankedCustomerIds = allInactiveIds.sort((a, b) => {
                      const lastOrderA = customerMetrics[a]?.lastOrder || '1970-01-01';
                      const lastOrderB = customerMetrics[b]?.lastOrder || '1970-01-01';
                      return new Date(lastOrderA).getTime() - new Date(lastOrderB).getTime();
                  });
              }

              totalCount = rankedCustomerIds.length;
              const paginatedIds = rankedCustomerIds.slice(from, to + 1);

              if (paginatedIds.length > 0) {
                  const { data: dbData, error } = await supabase.from('customers').select('*').in('id', paginatedIds);
                  if (error) throw error;
                  customerData = paginatedIds.map(id => (dbData || []).find(c => c.id === id)).filter(Boolean) as CustomerDbRow[];
              }

          } else {
              const query = supabase.from('customers').select('*', { count: 'exact' });
              if (search) {
                  query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
              }
              const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
              if (error) throw error;
              customerData = data || [];
              totalCount = count || 0;
          }
          
          const customers = customerData.map(transformDbRowToCustomer);
          const response: PaginatedResponse<Customer> = { data: customers, totalCount, currentPage, pageSize: size };
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(response) };
        }

      case 'POST':
      case 'PUT':
      case 'DELETE':
        if (event.httpMethod === 'POST') {
            const newCustomerClientData = JSON.parse(event.body || '{}');
            const { address, joinDate, instagramHandle, viberNumber, notes, ...restOfCustomerData } = newCustomerClientData;
            const customerToInsert = {
                ...restOfCustomerData,
                join_date: joinDate, 
                instagram_handle: instagramHandle || null,
                viber_number: viberNumber || null,
                notes: notes || null,
                address_street: address?.street || null,
                address_city: address?.city || null,
                address_state: address?.state || null,
                address_zip: address?.zip || null,
                address_country: address?.country || null,
            };
            const { data: createdDbData, error: createError } = await supabase.from('customers').insert(customerToInsert).select().single();
            if (createError) {
                if (createError.code === '23505') { // unique_violation on email
                    return { statusCode: 409, headers: commonHeaders, body: JSON.stringify({ message: 'Клієнт з таким email вже існує.' }) };
                }
                throw createError;
            }
            
            const createdCustomer = transformDbRowToCustomer(createdDbData as CustomerDbRow);
            return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(createdCustomer) };
        }
        if (event.httpMethod === 'PUT') {
            if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Customer ID required' }) };
            const updatedCustomerClientData = JSON.parse(event.body || '{}');
            const { address: updatedAddress, joinDate: updatedJoinDate, instagramHandle: updatedInstagram, viberNumber: updatedViber, notes: updatedNotes, ...restOfUpdatedCustomerData } = updatedCustomerClientData;
            const customerToUpdate = {
                ...restOfUpdatedCustomerData,
                join_date: updatedJoinDate, 
                instagram_handle: updatedInstagram || null,
                viber_number: updatedViber || null,
                notes: updatedNotes || null,
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
        }
        if (event.httpMethod === 'DELETE') {
            if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Customer ID required' }) };
            const { error: deleteError } = await supabase.from('customers').delete().eq('id', resourceId);
            if (deleteError) {
                if (deleteError.code === '23503') { // foreign_key_violation
                    return { statusCode: 409, headers: commonHeaders, body: JSON.stringify({ message: 'Неможливо видалити клієнта, оскільки у нього є існуючі замовлення.' }) };
                }
                throw deleteError;
            }
            return { statusCode: 204, headers: commonHeaders, body: '' };
        }
        break; 

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return {
        statusCode: error.statusCode,
        headers: commonHeaders,
        body: JSON.stringify({ message: error.message }),
      };
    }
    console.error('Error in netlify/functions/customers.ts:', error);
    const message = typeof error.message === 'string' ? error.message : 'An unexpected error occurred.';
    const details = typeof error.details === 'string' ? error.details : undefined;
    const hint = typeof error.hint === 'string' ? error.hint : undefined;
    let statusCode = 500;
    if (error?.code?.startsWith('PGRST')) {
      statusCode = 400;
    } else if (error?.status) {
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