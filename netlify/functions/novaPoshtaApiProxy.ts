

import { Handler } from '@netlify/functions';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    const { action, findByString, cityRef } = event.queryStringParameters || {};

    let requestBody: any = {
      apiKey: NP_API_KEY,
      modelName: '',
      calledMethod: '',
      methodProperties: {},
    };

    switch (action) {
      case 'searchSettlements': {
        requestBody.modelName = 'Address';
        requestBody.calledMethod = 'searchSettlements';
        requestBody.methodProperties = {
          CityName: findByString,
          Limit: 20,
        };
        const settlementsResponse = await fetch(NP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        const settlementsData = await settlementsResponse.json();
        if (!settlementsResponse.ok || !settlementsData.success) {
            console.error("Nova Poshta API returned an error:", settlementsData.errors, "for request:", requestBody);
            throw new Error(`Помилка API Нової Пошти: ${settlementsData.errors?.join(', ') || 'Unknown error'}`);
        }
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(settlementsData) };
      }
      case 'getWarehouses': {
        if (!cityRef) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'CityRef is required.' }) };
        }
        
        // This is the simplified and corrected logic. Always use FindByString.
        const methodProps = {
            CityRef: cityRef,
            Limit: 150,
            Language: "UA",
            FindByString: findByString || '' 
        };
        
        const npRequestBody = {
          apiKey: NP_API_KEY,
          modelName: 'Address',
          calledMethod: 'getWarehouses',
          methodProperties: methodProps,
        };
        
        const npResponse = await fetch(NP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(npRequestBody),
        });
        const data = await npResponse.json();

        if (!data.success) {
             console.error("Nova Poshta API returned an error:", data.errors, "for request:", npRequestBody);
             throw new Error(`Помилка API Нової Пошти: ${data.errors?.join(', ') || 'Unknown error'}`);
        }
        
        return {
          statusCode: 200,
          headers: commonHeaders,
          body: JSON.stringify({ success: true, data: data.data || [] }),
        };
      }
      default:
        return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Invalid action provided.' }) };
    }

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
