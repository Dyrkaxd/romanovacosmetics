import { Handler } from '@netlify/functions';
import { requireAuth } from '../utils/auth';
import type { NovaPoshtaTrackingInfo } from '../../types';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const NP_API_KEY = process.env.NOVA_POSHTA_API_KEY;

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  if (!NP_API_KEY) {
      console.error('Nova Poshta API key is not configured.');
      return {
          statusCode: 500,
          headers: commonHeaders,
          body: JSON.stringify({ message: 'Помилка конфігурації сервера: відсутній ключ API Нової Пошти.' }),
      };
  }

  try {
    await requireAuth(event);

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed.' }) };
    }

    const { ttns } = JSON.parse(event.body || '{}');

    if (!Array.isArray(ttns) || ttns.length === 0) {
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({}) };
    }

    const requestBody = {
      apiKey: NP_API_KEY,
      modelName: "TrackingDocument",
      calledMethod: "getStatusDocuments",
      methodProperties: {
        Documents: ttns.map(ttn => ({ DocumentNumber: ttn, Phone: "" })) // Phone is optional but required in the structure
      }
    };

    const npResponse = await fetch(NP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!npResponse.ok) {
      throw new Error(`Nova Poshta tracking API error: ${npResponse.statusText}`);
    }
    
    const responseData = await npResponse.json();

    if (responseData.success === false) {
      console.error("Nova Poshta tracking API returned an error:", responseData.errors);
      // It's better to return an empty object than to fail the entire page if tracking fails.
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({}) };
    }
    
    const trackingResults: Record<string, NovaPoshtaTrackingInfo> = {};
    responseData.data.forEach((item: any) => {
      trackingResults[item.Number] = {
        StatusCode: item.StatusCode,
        Status: item.Status,
        WarehouseSender: item.WarehouseSender,
        WarehouseRecipient: item.WarehouseRecipient,
        ScheduledDeliveryDate: item.ScheduledDeliveryDate,
        RecipientDateTime: item.RecipientDateTime,
        PayerType: item.PayerType,
        AmountToPay: item.AmountToPay,
      };
    });
    
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(trackingResults),
    };

  } catch (error: any) {
    // Gracefully handle auth errors
    if (error.statusCode) {
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in novaPoshtaTracking function:', error);
    // Return empty object on other errors to not break the frontend page
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({}),
    };
  }
};

export { handler };