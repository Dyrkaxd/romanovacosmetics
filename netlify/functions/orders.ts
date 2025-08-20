
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; 
import type { Order, OrderItem, Product, Customer, PaginatedResponse } from '../../types';
import type { Database } from '../../types/supabase';
import { requireAuth, AuthError, AuthenticatedUser } from '../utils/auth';

type OrderDbRow = Database['public']['Tables']['orders']['Row'];
type OrderItemDbRow = Database['public']['Tables']['order_items']['Row'];
type ProductDbRow = Database['public']['Tables']['products_bdr']['Row'];
type CustomerDbRow = Database['public']['Tables']['customers']['Row'];


const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const productGroupsMap: Record<string, string> = {
  'BDR': 'products_bdr', 'LA': 'products_la', 'АГ': 'products_ag', 'АБ': 'products_ab_cyr',
  'АР': 'products_ar_cyr', 'без сокращений': 'products_bez_sokr', 'АФ': 'products_af',
  'ДС': 'products_ds', 'м8': 'products_m8', 'JDA': 'products_jda', 'Faith': 'products_faith',
  'AB': 'products_ab_lat', 'ГФ': 'products_gf', 'ЕС': 'products_es', 'ГП': 'products_gp',
  'СД': 'products_sd', 'ATA': 'products_ata', 'W': 'products_w',
  'Гуаша': 'products_guasha',
};


// Helper to find a product across all tables
const findProductById = async (id: string): Promise<Product | null> => {
  if (!id) return null;
  for (const [group, tableName] of Object.entries(productGroupsMap)) {
    const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
    if (data) {
      const dbProduct = data as ProductDbRow;
      return {
          id: dbProduct.id,
          group,
          name: dbProduct.name,
          retailPrice: dbProduct.price,
          salonPrice: dbProduct.salon_price ?? 0,
          exchangeRate: dbProduct.exchange_rate ?? 0,
          quantity: dbProduct.quanity ?? 0,
          created_at: dbProduct.created_at || undefined,
      };
    }
  }
  return null;
};

// Helper function to transform a database customer row into a client-facing Customer object.
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
    created_at: dbCustomer.created_at || undefined,
  };
};

// Helper to transform DB row to Client Order type
const dbOrderToClientOrder = (dbOrder: OrderDbRow & { customers?: { name: string } | null, customer?: { name: string } | null }, items: OrderItemDbRow[] = []): Order => {
  const customerName = dbOrder.customers?.name || dbOrder.customer?.name || 'Unknown Customer';
  return {
    id: dbOrder.id,
    customerId: dbOrder.customer_id,
    customerName: customerName,
    date: dbOrder.date,
    status: dbOrder.status,
    totalAmount: dbOrder.total_amount,
    notes: dbOrder.notes || undefined,
    created_at: dbOrder.created_at || undefined,
    managedByUserEmail: dbOrder.managed_by_user_email || undefined,
    items: items.map(item => ({
        id: item.id,
        order_id: item.order_id,
        productId: item.product_id || '',
        productName: item.product_name,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        salonPriceUsd: item.salon_price_usd || 0,
        exchangeRate: item.exchange_rate || 0,
        created_at: item.created_at || undefined,
    })),
  };
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }
  
  const pathParts = event.path.split('/').filter(Boolean);
  const isBulkUpdate = pathParts[pathParts.length - 1] === 'bulk-status-update';
  const resourceId = (pathParts.length > 2 && !isBulkUpdate) ? pathParts[2] : null;

  // PUBLIC ACCESS FOR INVOICE VIEW: Allow GET for a single order without authentication.
  // Security relies on the unguessable UUID of the order ID.
  if (event.httpMethod === 'GET' && resourceId) {
    try {
        const { data: orderDbData, error: orderError } = await supabase
            .from('orders')
            .select('*, customer:customers(*)')
            .eq('id', resourceId)
            .single();

        if (orderError) throw orderError;
        if (!orderDbData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Order not found' }) };

        const { data: itemsDbData, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderDbData.id)
            .returns<OrderItemDbRow[]>();
        if (itemsError) throw itemsError;
        
        const clientOrder = dbOrderToClientOrder(orderDbData as any, itemsDbData || []);
        const fullCustomerData = orderDbData.customer ? transformDbRowToCustomer(orderDbData.customer as CustomerDbRow) : null;
        
        const responsePayload = { order: clientOrder, customer: fullCustomerData };
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(responsePayload) };

    } catch (error: any) {
        console.error('Public order fetch error:', error);
        return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'Error fetching order data.'})};
    }
  }

  // All other requests require authentication
  try {
    const user = await requireAuth(event);

    if (event.httpMethod === 'POST' && isBulkUpdate) {
        if (user.role !== 'admin') {
            return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Admins only.' }) };
        }
        const { ids, status } = JSON.parse(event.body || '{}');
        if (!Array.isArray(ids) || ids.length === 0 || !status) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order IDs and a new status are required.' }) };
        }
        const { count, error } = await supabase
            .from('orders')
            .update({ status: status })
            .in('id', ids);
        
        if (error) throw error;
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ message: `Successfully updated ${count} orders.` }) };
    }

    switch (event.httpMethod) {
      case 'GET': {
        const {
            page = '1', pageSize = '20', search = '', status, customerId,
            managerEmail, startDate, endDate,
          } = event.queryStringParameters || {};
          
          const currentPage = parseInt(page, 10);
          const size = parseInt(pageSize, 10);
          const from = (currentPage - 1) * size;
          const to = from + size - 1;

        let query = supabase
          .from('orders')
          .select('*, items:order_items(*), customer:customers(id, name)', { count: 'exact' });
        
        if (search) {
            const { data: customerIds, error: customerError } = await supabase
                .from('customers')
                .select('id')
                .ilike('name', `%${search}%`);
            
            if (customerError) throw customerError;
            
            const matchedCustomerIds = (customerIds || []).map(c => c.id);

            if (matchedCustomerIds.length > 0) {
                query.in('customer_id', matchedCustomerIds);
            } else {
                // If no customer matches the search term, no orders should be returned.
                // We add a condition that will always be false.
                query.eq('id', '00000000-0000-0000-0000-000000000000');
            }
        }
        
        if(status && status !== 'All') query.eq('status', status);
        if(customerId && customerId !== 'All') query.eq('customer_id', customerId);
        if(managerEmail && managerEmail !== 'All') query.eq('managed_by_user_email', managerEmail);
        if(startDate) query.gte('date', startDate);
        if(endDate) query.lte('date', endDate);


        const { data: ordersDbData, error: ordersError, count } = await query
          .order('date', { ascending: false })
          .range(from, to);

        if (ordersError) {
           throw ordersError;
        }

        const ordersWithClientItems = (ordersDbData as any[] || []).map(orderWithJoinedData => {
          return dbOrderToClientOrder(
              orderWithJoinedData,
              orderWithJoinedData.items || []
          );
        });
        
        const response: PaginatedResponse<Order> = {
            data: ordersWithClientItems,
            totalCount: count || 0,
            currentPage,
            pageSize: size,
        };

        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(response) };
      }

      case 'POST': {
        const clientNewOrderData = JSON.parse(event.body || '{}') as Partial<Order>;
        const { items: clientItems, customerId, totalAmount, notes, status, date } = clientNewOrderData;
        
        if (!customerId || totalAmount === undefined || totalAmount === null) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Customer ID and total amount are required.' }) };
        }

        const orderPayloadForDb: Partial<OrderDbRow> = {
            date: date || new Date().toISOString(),
            customer_id: customerId,
            total_amount: totalAmount,
            status: status || 'Ordered',
            notes: notes || null,
            managed_by_user_email: user.email, // Track who created the order
        };

        const { data: createdOrderDbRow, error: createOrderError } = await supabase
          .from('orders')
          .insert(orderPayloadForDb)
          .select()
          .single<OrderDbRow>();
        if (createOrderError) throw createOrderError;
        if (!createdOrderDbRow) throw new Error('Failed to create order, no data returned.');

        const { data: customerData } = await supabase.from('customers').select('name').eq('id', createdOrderDbRow.customer_id).single();

        let createdItemsDb: OrderItemDbRow[] = [];
        if (clientItems && clientItems.length > 0) {
            const itemsToInsertForDb = await Promise.all(clientItems.map(async (item) => {
              const productDetails = await findProductById(item.productId);
              return {
                  product_id: item.productId,
                  product_name: item.productName,
                  quantity: item.quantity,
                  price: item.price,
                  discount: item.discount,
                  order_id: createdOrderDbRow.id,
                  salon_price_usd: productDetails?.salonPrice,
                  exchange_rate: productDetails?.exchangeRate,
              };
          }));

          const { data: insertedItemsData, error: createItemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsertForDb)
            .select()
            .returns<OrderItemDbRow[]>();
          if (createItemsError) {
            console.error("Failed to insert order items, order created but items failed:", createItemsError);
            throw new Error(`Order created, but failed to insert items: ${createItemsError.message}`);
          }
          createdItemsDb = insertedItemsData || [];
        }
        
        const completeClientOrder = dbOrderToClientOrder({ ...createdOrderDbRow, customers: { name: customerData?.name || 'N/A' } }, createdItemsDb);
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(completeClientOrder) };
      }

      case 'PUT': {
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order ID required for update' }) };
        const clientUpdateOrderData = JSON.parse(event.body || '{}') as Partial<Order>;
        const { items: clientUpdatedItems, customerId, totalAmount, notes, status, date } = clientUpdateOrderData;
        
        const orderUpdatePayloadForDb: Partial<OrderDbRow> = {
            managed_by_user_email: user.email, // Always track the last updater
        };

        if (date !== undefined) orderUpdatePayloadForDb.date = date;
        if (status !== undefined) orderUpdatePayloadForDb.status = status;
        if (totalAmount !== undefined) orderUpdatePayloadForDb.total_amount = totalAmount;
        if (customerId !== undefined) orderUpdatePayloadForDb.customer_id = customerId;
        if (notes !== undefined) orderUpdatePayloadForDb.notes = notes || null;

        const { data: updatedOrderDbBase, error: updateOrderError } = await supabase
          .from('orders')
          .update(orderUpdatePayloadForDb)
          .eq('id', resourceId)
          .select('*, customer:customers(name)')
          .single();
        if (updateOrderError) throw updateOrderError;
        if (!updatedOrderDbBase) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Order not found or failed to update' })};

        let finalItemsDb: OrderItemDbRow[] = [];
         if (clientUpdatedItems && Array.isArray(clientUpdatedItems)) {
            const { error: deleteOldItemsError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', resourceId);
            if (deleteOldItemsError) throw new Error(`Failed to delete old items for update: ${deleteOldItemsError.message}`);

            if (clientUpdatedItems.length > 0) {
                 const newItemsToInsertForDb = await Promise.all(clientUpdatedItems.map(async (item) => {
                    const productDetails = await findProductById(item.productId);
                    return {
                        product_id: item.productId,
                        product_name: item.productName,
                        quantity: item.quantity,
                        price: item.price,
                        discount: item.discount,
                        order_id: resourceId,
                        salon_price_usd: item.salonPriceUsd ?? productDetails?.salonPrice,
                        exchange_rate: item.exchangeRate ?? productDetails?.exchangeRate,
                    };
                }));
                const { data: newInsertedItemsDb, error: insertNewItemsError } = await supabase
                    .from('order_items')
                    .insert(newItemsToInsertForDb)
                    .select()
                    .returns<OrderItemDbRow[]>();
                if (insertNewItemsError) throw new Error(`Failed to insert new items for update: ${insertNewItemsError.message}`);
                finalItemsDb = newInsertedItemsDb || [];
            }
        } else {
            const { data: existingItemsDbData, error: existingItemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', resourceId)
                .returns<OrderItemDbRow[]>();
            if (existingItemsError) throw existingItemsError;
            finalItemsDb = existingItemsDbData || [];
        }

        const completeUpdatedClientOrder = dbOrderToClientOrder(updatedOrderDbBase as any, finalItemsDb);
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(completeUpdatedClientOrder) };
      }

      case 'DELETE': {
        if (user.role !== 'admin' && user.role !== 'manager') {
          return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: You do not have permission to delete orders.' }) };
        }
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order ID required for delete' }) };
        const { error: deleteItemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', resourceId);
        if (deleteItemsError) {
             console.warn(`Could not delete items for order ${resourceId}, proceeding to delete order. Error: ${deleteItemsError.message}`);
        }
        const { error: deleteOrderError } = await supabase
          .from('orders')
          .delete()
          .eq('id', resourceId);
        if (deleteOrderError) throw deleteOrderError;
        return { statusCode: 204, headers: commonHeaders, body: '' };
      }

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
    console.error('Error in netlify/functions/orders.ts:', error);
    let message = 'An unexpected error occurred processing the order.';
    if(error.message) message = error.message;

    let statusCode = 500;
    // Check for specific PostgREST error codes
    if (error?.code?.startsWith('PGRST')) {
      statusCode = 400;
      if (error.code === '23503') { // foreign_key_violation
         message = "Invalid reference. The specified customer or product may not exist.";
      }
    }
    
    return {
      statusCode,
      headers: commonHeaders,
      body: JSON.stringify({ message, details: error.details, hint: error.hint }),
    };
  }
};

export { handler };
