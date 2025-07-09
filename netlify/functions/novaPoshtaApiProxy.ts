
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
      case 'searchSettlements':
        requestBody.modelName = 'Address';
        requestBody.calledMethod = 'searchSettlements';
        requestBody.methodProperties = {
          CityName: findByString,
          Limit: 20,
        };
        break;
      case 'getWarehouses':
        if (!cityRef) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'CityRef is required for getWarehouses action.' }) };
        }
        requestBody.modelName = 'Address';
        requestBody.calledMethod = 'getWarehouses';
        requestBody.methodProperties = {
          CityRef: cityRef,
          Limit: 500, // Limit number of results
          ...(findByString && { FindByString: findByString }),
        };
        break;
      default:
        return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Invalid action provided.' }) };
    }

    const npResponse = await fetch(NP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!npResponse.ok) {
      throw new Error(`Nova Poshta API error: ${npResponse.statusText}`);
    }

    const data = await npResponse.json();
    
    if (data.success === false) {
        console.error("Nova Poshta API returned an error:", data.errors);
        return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: `Помилка від API Нової Пошти: ${data.errors.join(', ')}`})};
    }

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
