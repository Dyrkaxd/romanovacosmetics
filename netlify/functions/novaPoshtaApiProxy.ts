
import { Handler } from '@netlify/functions';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Simulated Nova Poshta API data
const mockCities = [
  { Ref: "db5c6883-391c-11dd-90d9-001a92567626", Description: "Київ" },
  { Ref: "3b7b8f60-391c-11dd-90d9-001a92567626", Description: "Львів" },
  { Ref: "db5c6892-391c-11dd-90d9-001a92567626", Description: "Одеса" },
  { Ref: "db5c689a-391c-11dd-90d9-001a92567626", Description: "Харків" },
  { Ref: "db5c689d-391c-11dd-90d9-001a92567626", Description: "Дніпро" },
  { Ref: "db5c6887-391c-11dd-90d9-001a92567626", Description: "Вінниця" },
  { Ref: "db5c68b0-391c-11dd-90d9-001a92567626", Description: "Запоріжжя" },
];

const mockWarehouses: Record<string, { Ref: string; Description: string }[]> = {
  "db5c6883-391c-11dd-90d9-001a92567626": [ // Kyiv
    { Ref: "w-kyiv-1", Description: "Відділення №1: вул. Пирогівський шлях, 135" },
    { Ref: "w-kyiv-2", Description: "Відділення №2: вул. Бережанська, 9" },
    { Ref: "w-kyiv-150", Description: "Поштомат №150: вул. Хрещатик, 22" },
    { Ref: "w-kyiv-212", Description: "Відділення №212: просп. Відрадний, 24/93" },
  ],
  "3b7b8f60-391c-11dd-90d9-001a92567626": [ // Lviv
    { Ref: "w-lviv-1", Description: "Відділення №1: вул. Городоцька, 359" },
    { Ref: "w-lviv-3", Description: "Відділення №3: вул. Угорська, 22" },
    { Ref: "w-lviv-101", Description: "Поштомат №101: пл. Ринок, 1" },
  ],
   "db5c6892-391c-11dd-90d9-001a92567626": [ // Odesa
    { Ref: "w-odesa-1", Description: "Відділення №1: вул. Балківська, 199" },
    { Ref: "w-odesa-5", Description: "Відділення №5: вул. Академіка Корольова, 65а" },
  ],
};

const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: commonHeaders, body: '' };
    }
    
    const { action, findByString, cityRef } = event.queryStringParameters || {};

    // Simulate network delay
    await new Promise(res => setTimeout(res, 300 + Math.random() * 400));

    if (action === 'searchSettlements') {
        const results = findByString ? mockCities.filter(c => c.Description.toLowerCase().includes(findByString.toLowerCase())) : [];
        return {
            statusCode: 200,
            headers: commonHeaders,
            body: JSON.stringify({ data: [{ Addresses: results.slice(0, 10) }] }),
        };
    }

    if (action === 'getWarehouses') {
        if (!cityRef) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: "CityRef is required to get warehouses." })};
        }
        const cityWarehouses = mockWarehouses[cityRef] || [];
        const results = findByString ? cityWarehouses.filter(w => w.Description.toLowerCase().includes(findByString.toLowerCase())) : cityWarehouses;
        
        return {
            statusCode: 200,
            headers: commonHeaders,
            body: JSON.stringify({ data: results.slice(0, 15) }),
        };
    }

    return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({ message: 'Invalid action specified.' }),
    };
};

export { handler };
