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
          }));
          const { data: insertedItemsData, error: createItemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsert)
            .select();
          if (createItemsError) {
            // Rollback order creation attempt or log error critically
            console.error("Failed to insert order items, order created but items failed:", createItemsError);
            // Consider deleting the createdOrder here if items are critical
            // For now, we'll return the order with a warning or partial success
            throw new Error(`Order created, but failed to insert items: ${createItemsError.message}`);
          }
          createdItems = insertedItemsData || [];
        }
        
        const completeOrder: Order = { ...createdOrder, items: createdItems };
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(completeOrder) };

      case 'PUT': // Primarily for updating order status, or could handle item changes
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order ID required for update' }) };
        const { items: updatedItems, ...orderUpdateData } = JSON.parse(event.body || '{}') as Partial<Order>;
        delete orderUpdateData.id; // Don't allow changing ID

        const { data: updatedOrder, error: updateOrderError } = await supabase
          .from('orders')
          .update(orderUpdateData)
          .eq('id', resourceId)
          .select()
          .single();
        if (updateOrderError) throw updateOrderError;
        if (!updatedOrder) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Order not found or failed to update' })};

        // If updatedItems are provided, handle them (e.g., delete old items and insert new ones)
        // This is a complex operation; for simplicity, this example focuses on order status update.
        // A full item update would require deleting existing items for the order_id and inserting updatedItems.
        // For now, we assume items are managed separately or this PUT is just for status.
        let finalItems = updatedOrder.items || [];
         if (updatedItems && Array.isArray(updatedItems)) {
            // Simple approach: delete all existing items and add new ones
            const { error: deleteOldItemsError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', resourceId);
            if (deleteOldItemsError) throw new Error(`Failed to delete old items for update: ${deleteOldItemsError.message}`);

            if (updatedItems.length > 0) {
                const newItemsToInsert = updatedItems.map(item => ({
                    ...item,
                    order_id: resourceId,
                    id: undefined // Let DB generate new item IDs
                }));
                const { data: newInsertedItems, error: insertNewItemsError } = await supabase
                    .from('order_items')
                    .insert(newItemsToInsert)
                    .select();
                if (insertNewItemsError) throw new Error(`Failed to insert new items for update: ${insertNewItemsError.message}`);
                finalItems = newInsertedItems || [];
            } else {
                 finalItems = [];
            }
        } else {
            // If updatedItems not provided, fetch existing items
            const { data: existingItemsData, error: existingItemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', resourceId);
            if (existingItemsError) throw existingItemsError;
            finalItems = existingItemsData || [];
        }

        const completeUpdatedOrder: Order = { ...updatedOrder, items: finalItems };
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(completeUpdatedOrder) };

      case 'DELETE':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order ID required for delete' }) };
        // Supabase will cascade delete order_items if foreign key is set up with ON DELETE CASCADE
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', resourceId);
        if (deleteError) throw deleteError;
        return { statusCode: 204, headers: commonHeaders, body: '' };

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    console.error('Supabase error (orders):', error);
    return {
      statusCode: error.code && typeof error.code === 'string' && error.code.startsWith('PGRST') ? 400 : 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: error.message, details: error.details, hint: error.hint }),
    };
  }
};

export { handler };
