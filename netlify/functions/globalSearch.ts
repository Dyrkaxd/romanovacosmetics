import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { requireAuth } from '../utils/auth';
import type { GlobalSearchResult, Order, Product, Customer } from '../../types';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const productGroupsMap: Record<string, string> = {
  'BDR': 'products_bdr', 'LA': 'products_la', 'АГ': 'products_ag', 'АБ': 'products_ab_cyr',
  'АР': 'products_ar_cyr', 'без сокращений': 'products_bez_sokr', 'АФ': 'products_af',
  'ДС': 'products_ds', 'м8': 'products_m8', 'JDA': 'products_jda', 'Faith': 'products_faith',
  'AB': 'products_ab_lat', 'ГФ': 'products_gf', 'ЕС': 'products_es', 'ГП': 'products_gp',
  'СД': 'products_sd', 'ATA': 'products_ata', 'W': 'products_w',
  'Гуаша': 'products_guasha',
};

// --- Helper Functions to search different entities ---
const searchOrders = async (filters: any): Promise<GlobalSearchResult[]> => {
    let query = supabase.from('orders').select('*, customer:customers(name)').limit(5);
    if(filters.customerName) {
        query.ilike('customer.name', `%${filters.customerName}%`);
    }
    if(filters.id) {
        query.ilike('id', `%${filters.id}%`);
    }
    if(filters.sortBy === 'date') {
        query.order('date', { ascending: filters.sortOrder === 'asc' });
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((o: any) => ({
        type: 'order',
        id: o.id,
        title: `Замовлення #${o.id.substring(0, 8)}`,
        description: `Клієнт: ${o.customer?.name || 'N/A'}, Статус: ${o.status}`,
        url: `/invoice/${o.id}`
    }));
};

const searchCustomers = async (filters: any): Promise<GlobalSearchResult[]> => {
    let query = supabase.from('customers').select('*').limit(5);
    if (filters.name) {
        query.ilike('name', `%${filters.name}%`);
    }
     if (filters.email) {
        query.ilike('email', `%${filters.email}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((c: any) => ({
        type: 'customer',
        id: c.id,
        title: c.name,
        description: `Email: ${c.email}, Телефон: ${c.phone || 'N/A'}`,
        url: `/customers/${c.id}`
    }));
};

const searchProducts = async (filters: any): Promise<GlobalSearchResult[]> => {
    let allProducts: any[] = [];
    let tablesToSearch = filters.group ? [productGroupsMap[filters.group.toUpperCase() as keyof typeof productGroupsMap]].filter(Boolean) : Object.values(productGroupsMap);

    if (tablesToSearch.length === 0) tablesToSearch = Object.values(productGroupsMap);

    for (const tableName of tablesToSearch) {
        let query = supabase.from(tableName).select('id, name, quanity').limit(5);
        if (filters.name) {
            query.ilike('name', `%${filters.name}%`);
        }
        if (filters.stockLevel === 'low') {
            query.lt('quanity', 10);
        }
        const { data, error } = await query;
        if(error) continue; // Skip tables that error out
        if(data) {
           const groupName = Object.keys(productGroupsMap).find(key => productGroupsMap[key as keyof typeof productGroupsMap] === tableName) || 'N/A';
           allProducts.push(...data.map(p => ({...p, group: groupName })));
        }
    }

    return allProducts.slice(0, 10).map((p: any) => ({
        type: 'product',
        id: p.id,
        title: p.name,
        description: `Група: ${p.group}, Залишок: ${p.quanity || 0}`,
        url: `/products/${p.id}`
    }));
};

// Generic fallback search
const genericSearch = async (query: string): Promise<GlobalSearchResult[]> => {
    const [orders, customers, products] = await Promise.all([
        searchOrders({ id: query, customerName: query }),
        searchCustomers({ name: query }),
        searchProducts({ name: query }),
    ]);
    return [...orders, ...customers, ...products].slice(0, 10);
};

// --- Gemini AI Logic ---
const aiSearchSchema = {
    type: Type.OBJECT,
    properties: {
        intent: { type: Type.STRING, enum: ["search_orders", "search_customers", "search_products", "generic_text"] },
        filters: { 
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "Product or customer name" },
                id: { type: Type.STRING, description: "Order ID"},
                customerName: { type: Type.STRING, description: "Customer name for an order search"},
                group: { type: Type.STRING, description: "Product group, e.g., BDR, LA" },
                stockLevel: { type: Type.STRING, enum: ["low", "high", "any"] },
                sortBy: { type: Type.STRING, enum: ["date", "amount"] },
                sortOrder: { type: Type.STRING, enum: ["asc", "desc"] }
            }
        },
    }
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }
  
  try {
    const user = await requireAuth(event);
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error('AI service configuration error.');

    const { query } = event.queryStringParameters || {};
    if (!query) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Query parameter is required.' }) };
    
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Проаналізуй пошуковий запит користувача для системи управління інтернет-магазином косметики. Визнач намір (що шукати: замовлення, клієнтів чи товари) та витягни будь-які фільтри. Відповідай лише у форматі JSON, що відповідає наданій схемі. Якщо намір незрозумілий, встанови intent на "generic_text".

    Приклади:
    - "покажи останні замовлення для Олени Коваль" -> intent: "search_orders", filters: { customerName: "Олена Коваль", sortBy: "date", sortOrder: "desc" }
    - "товари з групи BDR, яких залишилось мало" -> intent: "search_products", filters: { group: "BDR", stockLevel: "low" }
    - "знайти клієнта самсоненко" -> intent: "search_customers", filters: { name: "самсоненко" }
    - "крем для обличчя" -> intent: "search_products", filters: { name: "крем для обличчя" }
    - "ID замовлення a1b2c3d4" -> intent: "search_orders", filters: { id: "a1b2c3d4" }

    Запит користувача: "${query}"`;
    
    let searchResults: GlobalSearchResult[] = [];

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: aiSearchSchema,
            },
        });
        
        let aiResponse;
        const responseText = response.text;
        if (typeof responseText === 'string') {
            aiResponse = JSON.parse(responseText.trim() || '{}');
        } else {
            aiResponse = { intent: 'generic_text', filters: {} };
        }
        
        const { intent, filters } = aiResponse;
        
        switch (intent) {
            case 'search_orders':
                searchResults = await searchOrders(filters);
                break;
            case 'search_customers':
                searchResults = await searchCustomers(filters);
                break;
            case 'search_products':
                searchResults = await searchProducts(filters);
                break;
            default:
                searchResults = await genericSearch(query);
                break;
        }
    } catch (aiError) {
        console.warn("AI search failed, falling back to generic search. Error:", aiError);
        searchResults = await genericSearch(query);
    }
    
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(searchResults) };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in globalSearch function:', error);
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: error.message || 'Server error during search.' }) };
  }
};

export { handler };