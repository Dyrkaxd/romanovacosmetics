import { Handler } from '@netlify/functions';
import { requireAuth } from '../utils/auth';


const API_URL = "https://api.novaposhta.ua/v2.0/json/";

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const callNpApi = async (apiKey: string, modelName: string, calledMethod: string, methodProperties = {}) => {
  const payload = { apiKey, modelName, calledMethod, methodProperties };
  const response = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Nova Poshta API error: ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.success) {
    const errorMessages = data.errors?.join(', ') || 'Unknown API error';
    throw new Error(errorMessages);
  }
  return data.data;
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

    const { apiKey } = JSON.parse(event.body || '{}');
    if (!apiKey) {
      return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'API Key is required.' }) };
    }

    // 1. Get Sender
    const senders = await callNpApi(apiKey, 'Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender' });
    if (!senders || senders.length === 0) {
      throw new Error('Відправника не знайдено. Перевірте API-ключ.');
    }
    const sender = senders[0];

    // 2. Get Contacts
    const contacts = await callNpApi(apiKey, 'Counterparty', 'getCounterpartyContactPersons', { Ref: sender.Ref });

    // 3. Get Addresses
    const addresses = await callNpApi(apiKey, 'Counterparty', 'getCounterpartyAddresses', { Ref: sender.Ref });

    // 4. Get City Ref from the primary address, if it exists
    let senderCityRef = null;
    if (addresses && addresses.length > 0) {
        const primaryAddressRef = addresses[0].Ref;
        const warehouseData = await callNpApi(apiKey, 'Address', 'getWarehouses', { Ref: primaryAddressRef, Limit: 1 });
        if (warehouseData && warehouseData.length > 0) {
            senderCityRef = warehouseData[0].CityRef;
        }
    }

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({
        sender,
        contacts,
        addresses,
        senderCityRef,
      }),
    };

  } catch (error: any) {
    console.error('Error in novaPoshtaHelper function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
    };
  }
};

export { handler };