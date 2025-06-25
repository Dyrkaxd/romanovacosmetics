import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Order, OrderItem } from '../../types';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error('API_KEY for Gemini is not set.');
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'AI service configuration error.' })};
  }

  try {
    // 1. Fetch recent orders from Supabase (e.g., last 20)
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, customer_name, date, status, total_amount, items:order_items(product_name, quantity, price)')
      .order('date', { ascending: false })
      .limit(20);

    if (ordersError) throw ordersError;
    if (!ordersData || ordersData.length === 0) {
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ summary: 'Недостатньо даних про замовлення для аналізу.' }) };
    }
    
    // Minimal data to send to Gemini to avoid large payload
    const summarizedOrders = ordersData.map(order => ({
        id: order.id,
        total_amount: order.total_amount,
        date: order.date,
        status: order.status,
        item_count: (order.items as OrderItem[])?.length || 0,
        // Optional: include top 1-2 product names if needed, but keep it light
        // top_items: (order.items as OrderItem[])?.slice(0,2).map(item => item.product_name).join(', ')
    }));


    // 2. Prepare prompt and call Gemini API
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Ти досвідчений аналітик даних електронної комерції. Проаналізуй наступні дані про останні замовлення та надай короткий підсумок (2-3 речення, приблизно 50-75 слів) ефективності продажів. Зверни увагу на будь-які помітні тенденції, загальний настрій (зростання, спад, стабільність) та, можливо, натякни на популярні категорії товарів, якщо це очевидно. Будь ласка, відповідай українською мовою.

Дані про замовлення:
${JSON.stringify(summarizedOrders, null, 2)}

Твій підсумок:`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17', // Use the recommended model
        contents: prompt,
    });

    const summaryText = response.text;
    
    if (!summaryText) {
        console.error('Gemini API returned no text.');
        return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'AI service failed to generate summary.' })};
    }

    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ summary: summaryText.trim() }) };

  } catch (error: any) {
    console.error('Error in dashboardSummary function:', error);
    // Check if it's a Gemini API specific error if possible, or a Supabase error
    const message = error.message || 'An unexpected error occurred.';
    // Avoid sending detailed internal errors to client unless necessary
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: `Failed to generate AI summary: ${message}` }),
    };
  }
};

export { handler };
