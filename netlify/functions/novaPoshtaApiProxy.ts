
import { Handler } from '@netlify/functions';

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
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed. Please use POST.' }) };
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
    const requestPayload = JSON.parse(event.body || '{}');

    if (!requestPayload.modelName || !requestPayload.calledMethod) {
      return { 
        statusCode: 400, 
        headers: commonHeaders, 
        body: JSON.stringify({ message: 'modelName and calledMethod are required in the request body.' }) 
      };
    }

    // Construct the final payload for Nova Poshta API by adding the API key
    const npRequestBody = {
      ...requestPayload,
      apiKey: NP_API_KEY,
    };

    const npResponse = await fetch(NP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(npRequestBody),
    });

    const data = await npResponse.json();

    if (!npResponse.ok || !data.success) {
      console.error("Nova Poshta API Error:", { errors: data.errors, warnings: data.warnings, info: data.info }, "for request:", requestPayload);
      // Pass the specific error from NP back to the client
      throw new Error(data.errors?.join(', ') || 'Unknown API error from Nova Poshta.');
    }
    
    // Forward the successful response from Nova Poshta to the client
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(data),
    };

  } catch (error: any) {
    console.error('Error in novaPoshtaApiProxy function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
    };
  }
};

export { handler };
