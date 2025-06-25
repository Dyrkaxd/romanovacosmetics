
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; // Adjusted path
import type { Order, OrderItem } from '../../types'; // Assuming types are correctly defined

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
          // Get single order by ID, including its items
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', resourceId)
            .single();
          if (orderError) throw orderError;
          if (!orderData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Order not found' }) };

          const { data: itemsData, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderData.id);
          if (itemsError) throw itemsError;
          
          const orderWithItems: Order = { ...orderData, items: itemsData || [] };
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(orderWithItems) };
        } else {
          // Get all orders, then fetch items for each
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .order('date', { ascending: false });
          if (ordersError) throw ordersError;

          const ordersWithItems = await Promise.all(
            (ordersData || []).map(async (order) => {
              const { data: items, error: itemsErr } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', order.id);
              if (itemsErr) {
                console.error(`Failed to fetch items for order ${order.id}:`, itemsErr);
                return { ...order, items: [] }; // Return order with empty items on error
              }
              return { ...order, items: items || [] };
            })
          );
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(ordersWithItems) };
        }

      case 'POST':
        const { items, ...newOrderData } = JSON.parse(event.body || '{}') as Partial<Order>;
        
        // Insert the main order record
        const { data: createdOrder, error: createOrderError } = await supabase
          .from('orders')
          .insert(newOrderData)
          .select()
          .single();
        if (createOrderError) throw createOrderError;
        if (!createdOrder) throw new Error('Failed to create order, no data returned.');

        // If items exist, insert them
        let createdItems: OrderItem[] = [];
        if (items && items.length > 0) {
          const itemsToInsert = items.map(item => ({
            ...item,
            order_id: createdOrder.id, // Link to the newly created order
            id: undefined // Let DB generate ID
          }));
          const { data: insertedItemsData, error: createItemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsert)
            .select();
          if (createItemsError) {
            console.error("Failed to insert order items, order created but items failed:", createItemsError);
            throw new Error(`Order created, but failed to insert items: ${createItemsError.message}`);
          }
          createdItems = insertedItemsData || [];
        }
        
        const completeOrder: Order = { ...createdOrder, items: createdItems };
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(completeOrder) };

      case 'PUT': 
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order ID required for update' }) };
        const { items: updatedItems, ...orderUpdateData } = JSON.parse(event.body || '{}') as Partial<Order>;
        delete orderUpdateData.id; 

        const { data: updatedOrderBase, error: updateOrderError } = await supabase
          .from('orders')
          .update(orderUpdateData)
          .eq('id', resourceId)
          .select()
          .single();
        if (updateOrderError) throw updateOrderError;
        if (!updatedOrderBase) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Order not found or failed to update' })};

        let finalItems: OrderItem[] = [];
         if (updatedItems && Array.isArray(updatedItems)) {
            const { error: deleteOldItemsError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', resourceId);
            if (deleteOldItemsError) throw new Error(`Failed to delete old items for update: ${deleteOldItemsError.message}`);

            if (updatedItems.length > 0) {
                const newItemsToInsert = updatedItems.map(item => ({
                    ...item,
                    order_id: resourceId,
                    id: undefined 
                }));
                const { data: newInsertedItems, error: insertNewItemsError } = await supabase
                    .from('order_items')
                    .insert(newItemsToInsert)
                    .select();
                if (insertNewItemsError) throw new Error(`Failed to insert new items for update: ${insertNewItemsError.message}`);
                finalItems = newInsertedItems || [];
            }
        } else {
            // If updatedItems not provided, fetch existing items to return the full order
            const { data: existingItemsData, error: existingItemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', resourceId);
            if (existingItemsError) throw existingItemsError; // Propagate error
            finalItems = existingItemsData || [];
        }

        const completeUpdatedOrder: Order = { ...updatedOrderBase, items: finalItems };
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(completeUpdatedOrder) };

      case 'DELETE':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order ID required for delete' }) };
        const { error: deleteItemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', resourceId);
        if (deleteItemsError) {
             console.warn(`Could not delete items for order ${resourceId}, proceeding to delete order. Error: ${deleteItemsError.message}`);
             // Depending on policy, you might want to stop or continue. Here we continue.
        }
        const { error: deleteOrderError } = await supabase
          .from('orders')
          .delete()
          .eq('id', resourceId);
        if (deleteOrderError) throw deleteOrderError;
        return { statusCode: 204, headers: commonHeaders, body: '' };

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    console.error('Error in netlify/functions/orders.ts:', error);
    const message = typeof error.message === 'string' ? error.message : 'An unexpected error occurred processing the order.';
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
