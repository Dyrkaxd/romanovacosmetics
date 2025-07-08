

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { requireAuth, AuthError } from '../utils/auth';

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

  try {
    // Both admin and manager can view the dashboard summary.
    await requireAuth(event);

    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error('API_KEY for Gemini is not set in environment variables for dashboardSummary function.');
      return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'AI service configuration error. API_KEY missing.' })};
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, date, status, total_amount, items:order_items(product_name, quantity, price)')
      .gte('date', thirtyDaysAgo.toISOString())
      .order('date', { ascending: false });

    if (ordersError) {
        console.error("Supabase error fetching orders for AI summary:", ordersError);
        throw ordersError;
    }
    if (!ordersData || ordersData.length === 0) {
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ summary: 'Недостатньо даних про замовлення за останні 30 днів для аналізу.' }) };
    }
    
    const summarizedOrders = ordersData.map((order: any) => ({
        total_amount: order.total_amount,
        date: order.date,
        status: order.status,
        item_count: order.items?.length || 0,
    }));

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Ти досвідчений аналітик даних електронної комерції. Проаналізуй наступні дані про замовлення за останні 30 днів та надай короткий підсумок (2-3 речення, приблизно 50-75 слів) ефективності продажів. Зверни увагу на будь-які помітні тенденції, загальний настрій (зростання, спад, стабільність). Будь ласка, відповідай українською мовою.

Дані про замовлення:
${JSON.stringify(summarizedOrders, null, 2)}

Твій підсумок:`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: prompt,
    });

    const summaryText = response.text;
    
    if (!summaryText) {
        console.error('Gemini API returned no text for dashboard summary.');
        return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'AI service failed to generate summary text.' })};
    }

    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ summary: summaryText.trim() }) };

  } catch (error: any) {
    if (error.statusCode) { // It's an AuthError from requireAuth
      return {
        statusCode: error.statusCode,
        headers: commonHeaders,
        body: JSON.stringify({ message: error.message }),
      };
    }

    console.error('Error in netlify/functions/dashboardSummary.ts:', error);
    let message = 'An unexpected error occurred while generating the AI summary.';
    if (error?.message) {
        message = error.message;
    }
    
    let statusCode = 500;
    if (error?.code?.startsWith('PGRST')) {
      statusCode = 400; // Bad request from Supabase
    }

    return {
      statusCode,
      headers: commonHeaders,
      body: JSON.stringify({ message }),
    };
  }
};

export { handler };