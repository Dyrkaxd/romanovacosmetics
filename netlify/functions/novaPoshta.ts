


import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';

const API_URL = "https://api.novaposhta.ua/v2.0/json/";

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    await requireAuth(event);

    const {
      orderId,
      recipient,
      recipientCityRef,
      recipientAddressRef,
      weight,
      volumeGeneral,
      description,
      cost,
      isCodEnabled,
    } = JSON.parse(event.body || '{}');

    const missingFields = ['orderId', 'recipient', 'recipientCityRef', 'recipientAddressRef', 'weight', 'volumeGeneral', 'description', 'cost']
      .filter(field => !JSON.parse(event.body || '{}')[field] && JSON.parse(event.body || '{}')[field] !== 0);
    
    if (missingFields.length > 0) {
        return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: `Missing required fields for TTN creation: ${missingFields.join(', ')}.` }) };
    }
    
    const {
        NOVA_POSHTA_API_KEY,
        NOVA_POSHTA_SENDER_REF,
        NOVA_POSHTA_SENDER_CONTACT_REF,
        NOVA_POSHTA_SENDER_ADDRESS_REF,
        NOVA_POSHTA_SENDER_PHONE
    } = process.env;

    if (!NOVA_POSHTA_API_KEY || !NOVA_POSHTA_SENDER_REF || !NOVA_POSHTA_SENDER_CONTACT_REF || !NOVA_POSHTA_SENDER_ADDRESS_REF || !NOVA_POSHTA_SENDER_PHONE) {
        return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: "Server configuration error: Nova Poshta credentials are not set."})};
    }
    
    // The sender's city must be looked up from the sender's warehouse address ref.
    const npAddressRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey: NOVA_POSHTA_API_KEY,
            modelName: "Address",
            calledMethod: "getWarehouses",
            methodProperties: { Ref: NOVA_POSHTA_SENDER_ADDRESS_REF }
        })
    });
    const npAddressData = await npAddressRes.json();
    if (!npAddressData.success || !npAddressData.data || npAddressData.data.length === 0) {
        console.error('NP Address Error:', npAddressData.errors);
        throw new Error(`Не вдалося отримати місто відправника. Помилка НП: ${npAddressData.errors.join(', ')}`);
    }
    const senderCityRef = npAddressData.data[0].CityRef;
    
    const methodProperties: any = {
      NewAddress: "1",
      PayerType: "Sender",
      PaymentMethod: "Cash",
      CargoType: "Parcel",
      VolumeGeneral: String(volumeGeneral),
      Weight: String(weight),
      ServiceType: "WarehouseWarehouse",
      SeatsAmount: "1",
      Description: description,
      Cost: String(cost),
      CitySender: senderCityRef,
      Sender: NOVA_POSHTA_SENDER_REF,
      SenderAddress: NOVA_POSHTA_SENDER_ADDRESS_REF,
      ContactSender: NOVA_POSHTA_SENDER_CONTACT_REF,
      SendersPhone: NOVA_POSHTA_SENDER_PHONE,
      CityRecipient: recipientCityRef,
      RecipientAddress: recipientAddressRef,
      RecipientName: recipient.name,
      RecipientsPhone: recipient.phone,
    };
    
    if (isCodEnabled) {
      methodProperties.BackwardDeliveryData = [{
          PayerType: "Recipient",
          CargoType: "Money",
          RedeliveryString: String(cost) // The COD amount is the total cost of the order
      }];
    }

    const payload = {
      apiKey: NOVA_POSHTA_API_KEY,
      modelName: "InternetDocument",
      calledMethod: "save",
      methodProperties,
    };
    
    const npResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const npData = await npResponse.json();

    if (!npData.success) {
      console.error('NP Creation Error:', npData.errors, npData.errorCodes);
      throw new Error(`Помилка створення ТТН: ${npData.errors.join(', ')}`);
    }
    
    const ttn = npData.data[0].IntDocNumber;
    const printUrl = `https://my.novaposhta.ua/orders/printDocument/orders[]/${ttn}/type/pdf/apiKey/${NOVA_POSHTA_API_KEY}`;
    
    // Update Supabase with TTN info AND the new status
    const { error: dbError } = await supabase
      .from('orders')
      .update({ 
          nova_poshta_ttn: ttn, 
          nova_poshta_print_url: printUrl,
          status: 'Shipped' // Automatically update status
      })
      .eq('id', orderId);
      
    if (dbError) {
      console.error(`DB update error after creating TTN ${ttn} for order ${orderId}:`, dbError);
      throw new Error(`ТТН ${ttn} створено, але не вдалося оновити замовлення в базі даних.`);
    }

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ ttn, printUrl }),
    };

  } catch (error: any) {
    console.error('Error in novaPoshta function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
    };
  }
};

export { handler };