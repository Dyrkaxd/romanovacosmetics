

import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';
import type { Order, Customer, OrderItem } from '../../types';
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


const dbOrderToClientOrder = (dbOrder: OrderDbRow & { customer?: { name: string } | null }, items: OrderItemDbRow[] = []): Order => {
  const customerName = dbOrder.customer?.name || 'Unknown Customer';
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

const toNpDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
};

const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: commonHeaders, body: '' };
    }

    const NP_API_KEY = process.env.NOVA_POSHTA_API_KEY;
    const SENDER_REF = process.env.NOVA_POSHTA_SENDER_REF;
    const SENDER_CONTACT_REF = process.env.NOVA_POSHTA_SENDER_CONTACT_REF;
    const SENDER_ADDRESS_REF = process.env.NOVA_POSHTA_SENDER_ADDRESS_REF;
    const SENDER_PHONE = process.env.NOVA_POSHTA_SENDER_PHONE;

    if (!NP_API_KEY || !SENDER_REF || !SENDER_CONTACT_REF || !SENDER_ADDRESS_REF || !SENDER_PHONE) {
        console.error('One or more Nova Poshta sender environment variables are not set.');
        return { statusCode: 500, body: JSON.stringify({ message: 'Помилка конфігурації сервера: відсутні дані відправника.' }), headers: commonHeaders };
    }

    try {
        await requireAuth(event);

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed.' }) };
        }

        const { orderId, city, warehouse, weight, length, width, height, description } = JSON.parse(event.body || '{}');
        if (!orderId || !city || !warehouse || !weight || !description || !length || !width || !height) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Необхідно надати повну інформацію для створення ТТН.' }) };
        }

        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*, customer:customers(*)')
            .eq('id', orderId)
            .single();
        
        if (orderError || !orderData) {
            return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: `Замовлення з ID ${orderId} не знайдено.` }) };
        }
        
        const customer = orderData.customer as CustomerDbRow;
        if (!customer) {
            return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Дані клієнта для цього замовлення не знайдено.' }) };
        }

        // Fetch sender's city Ref from their warehouse address Ref
        const senderAddressDetailsResponse = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: NP_API_KEY,
                modelName: "Address",
                calledMethod: "getWarehouses",
                methodProperties: {
                    Ref: SENDER_ADDRESS_REF,
                }
            }),
        });
        const senderAddressDetailsData = await senderAddressDetailsResponse.json();
        if (!senderAddressDetailsData.success || !senderAddressDetailsData.data || senderAddressDetailsData.data.length === 0) {
            console.error("Failed to get sender address details from Nova Poshta:", senderAddressDetailsData.errors);
            throw new Error('Не вдалося отримати деталі адреси відправника з Нової Пошти.');
        }
        const senderCityRef = senderAddressDetailsData.data[0].CityRef;
        const volume = (length * width * height) / 1000000;

        const apiPayload = {
            apiKey: NP_API_KEY,
            modelName: "InternetDocument",
            calledMethod: "save",
            methodProperties: {
                PayerType: "Recipient",
                PaymentMethod: "Cash",
                CargoType: "Parcel",
                VolumeGeneral: volume > 0.0001 ? volume.toFixed(4) : "0.0001",
                Weight: weight,
                ServiceType: "WarehouseWarehouse",
                SeatsAmount: "1",
                Description: description,
                Cost: orderData.total_amount,
                CitySender: senderCityRef,
                Sender: SENDER_REF,
                SenderAddress: SENDER_ADDRESS_REF,
                ContactSender: SENDER_CONTACT_REF,
                SendersPhone: SENDER_PHONE,
                CityRecipient: city.id,
                RecipientAddress: warehouse.id,
                RecipientsPhone: customer.phone,
                RecipientName: customer.name,
                DateTime: toNpDate(new Date()),
            },
        };

        const npResponse = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload),
        });
        
        const npData = await npResponse.json();

        if (npResponse.status !== 200 || !npData.success) {
            console.error("Nova Poshta TTN creation failed:", npData.errors, "for request payload:", apiPayload.methodProperties);
            throw new Error(`Помилка API Нової Пошти: ${npData.errors.join(', ')}`);
        }
        
        const ttnResult = npData.data[0];
        const ttnNumber = ttnResult.IntDocNumber;
        const ttnRef = ttnResult.Ref;
        const printUrl = `https://my.novaposhta.ua/orders/printDocument/orders[]/${ttnRef}/type/pdf/apiKey/${NP_API_KEY}`;
        
        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update({
                nova_poshta_ttn: ttnNumber,
                nova_poshta_print_url: printUrl,
                status: 'Shipped'
            })
            .eq('id', orderId)
            .select('*, customer:customers(name), items:order_items(*)')
            .single();

        if (updateError) throw updateError;

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
