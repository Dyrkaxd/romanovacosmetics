
import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';
import type { Order, Customer } from '../../types';
import type { Database } from '../../types/supabase';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

type OrderDbRow = Database['public']['Tables']['orders']['Row'];
type CustomerDbRow = Database['public']['Tables']['customers']['Row'];
type OrderItemDbRow = Database['public']['Tables']['order_items']['Row'];

// I'll copy this from orders.ts
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
    novaPoshtaTtn: dbOrder.nova_poshta_ttn || undefined,
    novaPoshtaPrintUrl: dbOrder.nova_poshta_print_url || undefined,
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


const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: commonHeaders, body: '' };
    }

    try {
        const user = await requireAuth(event);

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed.' }) };
        }

        const { orderId, warehouse, weight, length, width, height, description } = JSON.parse(event.body || '{}');

        if (!orderId || !warehouse) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Order ID and Warehouse are required.' }) };
        }

        // Simulate Nova Poshta API call
        // 1. Fetch order details to ensure it exists
        const { data: orderData, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (orderError || !orderData) {
            return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Order not found.' }) };
        }

        // 2. Generate fake TTN and print URL
        const fakeTtn = `204500${Math.floor(10000000 + Math.random() * 90000000)}`;
        const printUrl = `${process.env.URL || 'http://localhost:8888'}/#/bill-of-lading/${orderId}`;
        
        // 3. Update the order in Supabase
        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update({
                nova_poshta_ttn: fakeTtn,
                nova_poshta_print_url: printUrl,
                status: 'Shipped' // Automatically update status to Shipped
            })
            .eq('id', orderId)
            .select('*, customer:customers(name), items:order_items(*)')
            .single();

        if (updateError) throw updateError;

        // 4. Return the fully updated order object
        const clientOrder = dbOrderToClientOrder(updatedOrder as any, updatedOrder.items || []);
        
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(clientOrder) };

    } catch (error: any) {
        if (error.statusCode) { // AuthError
            return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
        }
        console.error('Error in novaPoshta function:', error);
        return {
            statusCode: 500,
            headers: commonHeaders,
            body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
        };
    }
};

export { handler };