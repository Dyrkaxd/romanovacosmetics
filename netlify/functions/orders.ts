
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; 
import type { Order, OrderItem } from '../../types';
import type { Database } from '../../types/supabase';

type OrderDbRow = Database['public']['Tables']['orders']['Row'];
type OrderItemDbRow = Database['public']['Tables']['order_items']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
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
    created_at: dbOrder.created_at || undefined,
    items: items.map(item => ({
        id: item.id,
        order_id: item.order_id,
        productId: item.product_id || '',
        productName: item.product_name,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        created_at: item.created_at || undefined,
    })),
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
      case 'GET': {
        if (resourceId) {
          const { data: orderDbData, error: orderError } = await supabase
            .from('orders')
            .select('*, customers ( name )')
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
          
          const clientOrder = dbOrderToClientOrder(orderDbData, itemsDbData || []);
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(clientOrder) };
        } else {
          const { data: ordersDbData, error: ordersError } = await supabase
            .from('orders')
            .select('*, items:order_items(*), customer:customers(name)')
            .order('date', { ascending: false });

          if (ordersError) throw ordersError;

          const ordersWithClientItems = (ordersDbData as any[] || []).map(orderWithJoinedData => {
            return dbOrderToClientOrder(
                orderWithJoinedData,
                orderWithJoinedData.items || []
            );
          });

          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(ordersWithClientItems) };
        }
      }

      case 'POST': {
        const clientNewOrderData = JSON.parse(event.body || '{}') as Partial<Order>;
        const { items: clientItems, customerId, customerName, totalAmount, ...restOfClientOrderData } = clientNewOrderData;
        
        if (!customerId || totalAmount === undefined || totalAmount === null) {
          return {
            statusCode: 400,
            headers: commonHeaders,
            body: JSON.stringify({ message: 'Customer ID and total amount are required.' }),
          };
        }

        const orderPayloadForDb = {
            ...restOfClientOrderData,
            date: restOfClientOrderData.date || new Date().toISOString(),
            customer_id: customerId,
            total_amount: totalAmount,
            status: restOfClientOrderData.status || 'Pending',
        };

        const { data: createdOrderDbRow, error: createOrderError } = await supabase
          .from('orders')
          .insert(orderPayloadForDb)
          .select()
          .single<OrderDbRow>();
        if (createOrderError) throw createOrderError;
        if (!createdOrderDbRow) throw new Error('Failed to create order, no data returned.');

        // Fetch the customer's name for the response
        const { data: customerData } = await supabase.from('customers').select('name').eq('id', createdOrderDbRow.customer_id).single();

        let createdItemsDb: OrderItemDbRow[] = [];
        if (clientItems && clientItems.length > 0) {
          const itemsToInsertForDb = clientItems.map(item => ({
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            order_id: createdOrderDbRow.id,
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
        const { items: clientUpdatedItems, customerId: clientCustomerIdToUpdate, customerName: customerNameToIgnore, totalAmount, ...restOfClientUpdateData } = clientUpdateOrderData;
        
        const orderUpdatePayloadForDb: Partial<OrderDbRow> = {
            ...restOfClientUpdateData,
        };

        if (totalAmount !== undefined) {
            orderUpdatePayloadForDb.total_amount = totalAmount; // Correctly map camelCase to snake_case
        }
        if (clientCustomerIdToUpdate !== undefined) {
            orderUpdatePayloadForDb.customer_id = clientCustomerIdToUpdate;
        }

        delete (orderUpdatePayloadForDb as any).id;
        delete (orderUpdatePayloadForDb as any).items; 
        delete (orderUpdatePayloadForDb as any).customerId;
        delete (orderUpdatePayloadForDb as any).created_at;

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
                const newItemsToInsertForDb = clientUpdatedItems.map(item => ({
                    product_id: item.productId,
                    product_name: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    discount: item.discount,
                    order_id: resourceId,
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

        const completeUpdatedClientOrder = dbOrderToClientOrder(updatedOrderDbBase, finalItemsDb);
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(completeUpdatedClientOrder) };
      }

      case 'DELETE': {
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
    console.error('Error in netlify/functions/orders.ts:', error);
    let message = typeof error.message === 'string' ? error.message : 'An unexpected error occurred processing the order.';
    const details = typeof error.details === 'string' ? error.details : undefined;
    const hint = typeof error.hint === 'string' ? error.hint : undefined;
    
    let statusCode = 500;
    if (error && error.code && typeof error.code === 'string' && error.code.startsWith('PGRST')) {
      statusCode = 400; // Bad request from Supabase
      if (error.code === '23503' && error.details?.includes('orders_customer_id_fkey')) {
         message = "Invalid customer ID. The specified customer does not exist.";
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
