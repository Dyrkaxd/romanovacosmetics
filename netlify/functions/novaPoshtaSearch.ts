
import { Handler } from '@netlify/functions';
import { requireAuth } from '../utils/auth';

const API_URL = "https://api.novaposhta.ua/v2.0/json/";

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const callNpApi = async (modelName: string, calledMethod: string, methodProperties = {}) => {
  const { NOVA_POSHTA_API_KEY } = process.env;
  if (!NOVA_POSHTA_API_KEY) {
    throw new Error("Server configuration error: Nova Poshta API Key is not set.");
  }
  
  const payload = { apiKey: NOVA_POSHTA_API_KEY, modelName, calledMethod, methodProperties };
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
    // It's not a server error if NP says "not found"
    if(data.errorCodes?.includes('20000400600')) {
        return [];
    }
    throw new Error(errorMessages);
  }
  return data.data;
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
        const { type, query, cityRef } = event.queryStringParameters || {};

        let data;
        if (type === 'cities') {
            if (!query) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: '`query` parameter is required for cities search.' }) };
            
            const results = await callNpApi("Address", "searchSettlements", { CityName: query, Limit: 10 });
            data = (results[0]?.Addresses || []).map((addr: any) => ({
                Ref: addr.Ref,
                Description: addr.Present,
                AreaDescription: addr.Area
            }));

        } else if (type === 'departments') {
             if (!cityRef) {
                return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: '`cityRef` parameter is required for departments search.' }) };
             }
            
            // Fetch all warehouses for a city. The 'query' parameter is ignored for performance.
            // Nova Poshta API has a max limit of 500 for getWarehouses.
            const methodProperties = { 
                CityRef: cityRef,
                Limit: "500" 
            };
            
            data = await callNpApi("Address", "getWarehouses", methodProperties);

        } else {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Invalid search `type` provided.' }) };
        }
        
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data || []) };

    } catch (error: any) {
        if (error.statusCode) { // AuthError
            return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
        }
        console.error('Error in novaPoshtaSearch function:', error);
        return {
            statusCode: 500,
            headers: commonHeaders,
            body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
        };
    }
};

export { handler };