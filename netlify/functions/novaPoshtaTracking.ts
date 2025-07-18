import { Handler } from '@netlify/functions';
import { requireAuth } from '../utils/auth';

const API_URL = "https://api.novaposhta.ua/v2.0/json/";

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    await requireAuth(event);

    const { ttn } = event.queryStringParameters || {};
    if (!ttn) {
      return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'TTN number is required.' }) };
    }

    const { NOVA_POSHTA_API_KEY } = process.env;
    if (!NOVA_POSHTA_API_KEY) {
      console.error('Missing Nova Poshta API key for tracking.');
      return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'Server configuration error: Missing Nova Poshta credentials.' }) };
    }

    const payload = {
      apiKey: NOVA_POSHTA_API_KEY,
      modelName: "TrackingDocument",
      calledMethod: "getStatusDocuments",
      methodProperties: {
        Documents: [{ DocumentNumber: ttn, Phone: "" }]
      }
    };

    const npResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const npData = await npResponse.json();

    if (!npResponse.ok || !npData.success || !npData.data || npData.data.length === 0) {
      const errorMessages = npData.errors?.join(', ') || `TTN ${ttn} не знайдено або сталася помилка API.`;
      console.error('NP Tracking Error:', npData.errors, npData.errorCodes);
      throw new Error(errorMessages);
    }

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(npData.data[0]),
    };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
        return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in novaPoshtaTracking function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred while tracking shipment.' }),
    };
  }
};

export { handler };