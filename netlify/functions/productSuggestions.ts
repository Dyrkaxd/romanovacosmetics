
import { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { requireAuth } from '../utils/auth';
import type { Product, OrderItem } from '../../types';
import type { Database } from '../../types/supabase';

type ProductDbRow = Database['public']['Tables']['products_bdr']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const productGroupsMap: Record<string, string> = {
  'BDR': 'products_bdr', 'LA': 'products_la', 'АГ': 'products_ag', 'АБ': 'products_ab_cyr',
  'АР': 'products_ar_cyr', 'без сокращений': 'products_bez_sokr', 'АФ': 'products_af',
  'ДС': 'products_ds', 'м8': 'products_m8', 'JDA': 'products_jda', 'Faith': 'products_faith',
  'AB': 'products_ab_lat', 'ГФ': 'products_gf', 'ЕС': 'products_es', 'ГП': 'products_gp',
  'СД': 'products_sd', 'ATA': 'products_ata', 'W': 'products_w',
};
type ProductGroupName = keyof typeof productGroupsMap;

const transformDbRowToProduct = (dbProduct: ProductDbRow, group: ProductGroupName): Product => ({
    id: dbProduct.id, group, name: dbProduct.name, retailPrice: dbProduct.price,
    salonPrice: dbProduct.salon_price ?? 0, exchangeRate: dbProduct.exchange_rate ?? 0,
    quantity: dbProduct.quanity ?? 0, created_at: dbProduct.created_at || undefined,
});

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    await requireAuth(event);
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error('AI service configuration error.');

    const { items: currentItems } = JSON.parse(event.body || '{}') as { items: OrderItem[] };
    if (!Array.isArray(currentItems) || currentItems.length === 0) {
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify([]) };
    }

    const productPromises = Object.values(productGroupsMap).map(tableName => 
        supabase.from(tableName).select('name')
    );
    const productResults = await Promise.all(productPromises);
    const allProductNames = productResults.map(res => res.data?.map((p: { name: string }) => p.name) || []).flat();
    const uniqueProductNames = [...new Set(allProductNames)];

    const currentItemNames = currentItems.map(item => item.productName);
    const availableForSuggestion = uniqueProductNames.filter(name => !currentItemNames.includes(name));

    const prompt = `You are a helpful shopping assistant for a cosmetics store. Given a list of items currently in a customer's cart, and a list of all available products, suggest 3 to 5 complementary products. Only suggest products from the provided available products list. Do not suggest products already in the cart. Respond ONLY with a JSON array of the suggested product names that matches the schema. Respond in Ukrainian.

Current Cart Items: ${JSON.stringify(currentItemNames)}
Available Products for Suggestion: ${JSON.stringify(availableForSuggestion.slice(0, 300))} 

Your JSON response:`;

    const ai = new GoogleGenAI({ apiKey });
    const schema = { type: Type.ARRAY, items: { type: Type.STRING } };
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    let suggestedNames: string[] = [];
    try {
        const responseText = response.text;
        if (typeof responseText === 'string') {
            suggestedNames = JSON.parse(responseText.trim() || '[]');
        }
    } catch(e: any) {
        console.error("Failed to parse Gemini JSON. Response text:", response.text, "Error:", e.message || String(e));
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify([]) };
    }

    if (suggestedNames.length === 0) {
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify([]) };
    }

    const suggestedProducts: Product[] = [];
    for (const name of suggestedNames.slice(0, 5)) { 
        for (const [group, tableName] of Object.entries(productGroupsMap)) {
            const { data } = await supabase.from(tableName).select('*').eq('name', name).limit(1).single();
            if (data) {
                suggestedProducts.push(transformDbRowToProduct(data as ProductDbRow, group as ProductGroupName));
                break; 
            }
        }
    }
    
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(suggestedProducts) };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in productSuggestions function:', error);
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'Server error during AI suggestion.' }) };
  }
};

export { handler };
