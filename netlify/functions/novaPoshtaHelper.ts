
import { Handler } from '@netlify/functions';
import type { NovaPoshtaHelperResult } from '../../types';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

const callNpApi = async (apiKey: string, modelName: string, calledMethod: string, methodProperties: any = {}) => {
    const response = await fetch(NP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.errors?.join(', ') || `API call to ${modelName}/${calledMethod} failed.`);
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
        const { apiKey } = JSON.parse(event.body || '{}');
        if (!apiKey) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Nova Poshta API Key is required.' }) };
        }

        const result: NovaPoshtaHelperResult = {};

        // 1. Get Sender
        try {
            const senders = await callNpApi(apiKey, 'Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender' });
            if (senders && senders.length > 0) {
                result.sender = { Ref: senders[0].Ref, Description: senders[0].Description };
            } else {
                result.sender = { error: 'Відправника не знайдено. Перевірте ваш API ключ.' };
            }
        } catch (error: any) {
            result.sender = { error: `Помилка отримання відправника: ${error.message}` };
        }
        
        // 2. Get Contact Person
        if (result.sender && 'Ref' in result.sender) {
            try {
                const contacts = await callNpApi(apiKey, 'Counterparty', 'getCounterpartyContactPersons', { Ref: result.sender.Ref });
                if (contacts && contacts.length > 0) {
                    const contact = contacts[0];
                    result.contact = { 
                        Ref: contact.Ref, 
                        Description: contact.Description,
                        phone: contact.Phones.split(',')[0].trim().replace(/[^0-9]/g, '') || undefined // Get first phone, digits only
                    };
                } else {
                    result.contact = { error: 'Контактну особу не знайдено.' };
                }
            } catch (error: any) {
                result.contact = { error: `Помилка отримання контактної особи: ${error.message}` };
            }
        } else {
             result.contact = { error: 'Неможливо шукати контактну особу без відправника.' };
        }
        
        // 3. Get Address
        if (result.sender && 'Ref' in result.sender) {
             try {
                const addresses = await callNpApi(apiKey, 'Counterparty', 'getCounterpartyAddresses', { Ref: result.sender.Ref });
                if (addresses && addresses.length > 0) {
                    result.address = { Ref: addresses[0].Ref, Description: addresses[0].Description };
                } else {
                    result.address = { error: 'Адресу не знайдено. Будь ласка, додайте адресу у вашому бізнес-кабінеті Нової Пошти.' };
                }
            } catch (error: any) {
                result.address = { error: `Помилка отримання адреси: ${error.message}` };
            }
        } else {
            result.address = { error: 'Неможливо шукати адресу без відправника.' };
        }

        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(result) };

    } catch (error: any) {
        console.error('Error in novaPoshtaHelper function:', error);
        return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }) };
    }
};

export { handler };
