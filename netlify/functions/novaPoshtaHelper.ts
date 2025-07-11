
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

    // 4. Get City Ref from the primary address, or fall back to searching by city name
    let senderCityRef = null;
    if (addresses && addresses.length > 0 && addresses[0].CityRef) {
        // Preferred method: Get CityRef directly from the saved address
        senderCityRef = addresses[0].CityRef;
    } else if (sender.City) {
        // Fallback: If no address is saved, use the sender's city name to find the Ref.
        // This is a huge UX improvement as it unblocks users without a saved address.
        console.warn(`No address found for sender ${sender.Ref}. Falling back to city name search: "${sender.City}".`);
        const settlementData = await callNpApi(apiKey, 'Address', 'searchSettlements', { CityName: sender.City, Limit: 1 });
        if (settlementData && settlementData[0]?.Addresses && settlementData[0].Addresses[0]) {
            senderCityRef = settlementData[0].Addresses[0].Ref;
        } else {
            console.warn(`Could not resolve CityRef for city name "${sender.City}".`);
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