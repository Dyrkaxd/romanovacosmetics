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
        const { cityName } = event.queryStringParameters || {};
        if (!cityName) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'cityName query parameter is required.' }) };
        }

        const { NOVA_POSHTA_API_KEY } = process.env;
        if (!NOVA_POSHTA_API_KEY) {
            return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: "Server configuration error: Nova Poshta API Key is not set." }) };
        }

        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: NOVA_POSHTA_API_KEY,
                modelName: "Address",
                calledMethod: "searchSettlements",
                methodProperties: { CityName: cityName, Limit: 1 }
            })
        });

        if (!res.ok) {
            throw new Error(`Nova Poshta API request failed with status ${res.status}`);
        }
        
        const data = await res.json();

        if (!data.success || !data.data || data.data.length === 0 || !data.data[0].Addresses || data.data[0].Addresses.length === 0) {
            // It's not an error if the city is not found, frontend will handle it.
            return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ ref: null }) };
        }
        
        // Return the Ref of the first found settlement address
        const settlement = data.data[0].Addresses[0];
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ ref: settlement.Ref }) };

    } catch (error: any) {
        if (error.statusCode) { // AuthError
            return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
        }
        console.error('Error in novaPoshtaCityResolver function:', error);
        return {
            statusCode: 500,
            headers: commonHeaders,
            body: JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
        };
    }
};

export { handler };