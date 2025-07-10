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
    } = JSON.parse(event.body || '{}');

    if (!orderId || !recipient || !recipientCityRef || !recipientAddressRef || !weight || !volumeGeneral || !description) {
      return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Missing required fields for TTN creation.' }) };
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

    // We need to get the sender's city Ref from the sender's address Ref
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
        throw new Error('Не вдалося отримати місто відправника.');
    }
    const senderCityRef = npAddressData.data[0].CityRef;
    
    const payload = {
      apiKey: NOVA_POSHTA_API_KEY,
      modelName: "InternetDocument",
      calledMethod: "save",
      methodProperties: {
        NewAddress: "1",
        PayerType: "Sender",
        PaymentMethod: "Cash",
        CargoType: "Parcel",
        VolumeGeneral: volumeGeneral,
        Weight: weight,
        ServiceType: "WarehouseWarehouse",
        SeatsAmount: "1",
        Description: description,
        Cost: "1", // Required field, set to a nominal value
        CitySender: senderCityRef,
        Sender: NOVA_POSHTA_SENDER_REF,
        SenderAddress: NOVA_POSHTA_SENDER_ADDRESS_REF,
        ContactSender: NOVA_POSHTA_SENDER_CONTACT_REF,
        SendersPhone: NOVA_POSHTA_SENDER_PHONE,
        CityRecipient: recipientCityRef,
        RecipientAddress: recipientAddressRef,
        RecipientName: recipient.name,
        RecipientsPhone: recipient.phone,
      },
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
    
    // Update Supabase
    const { error: dbError } = await supabase
      .from('orders')
      .update({ nova_poshta_ttn: ttn, nova_poshta_print_url: printUrl })
      .eq('id', orderId);
      
    if (dbError) throw dbError;

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
