import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { requireAuth, AuthError } from '../utils/auth';
import type { AIInsight } from '../../types';

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
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const user = await requireAuth(event);
    if (user.role !== 'admin') {
      return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Admin access required for AI insights.' }) };
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error('AI service configuration error. API_KEY missing.');
    }

    const rawInsights: any[] = [];

    // 1. Find low stock products
    const lowStockThreshold = 10;
    const productPromises = Object.values(productGroupsMap).map(tableName => 
        supabase.from(tableName).select('name, quanity').lt('quanity', lowStockThreshold)
    );
    const productResults = await Promise.all(productPromises);

    for (const result of productResults) {
        if (result.data) {
            result.data.forEach(product => {
                rawInsights.push({
                    type: 'low_stock',
                    productName: product.name,
                    quantity: product.quanity,
                });
            });
        }
    }

    // 2. Find inactive customers
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: recentCustomers, error: customersError } = await supabase
        .from('customers')
        .select('id, name, join_date')
        .gt('join_date', ninetyDaysAgo.toISOString());
    
    if(customersError) throw customersError;

    if (recentCustomers) {
        for (const customer of recentCustomers) {
            const { data: lastOrder, error: orderError } = await supabase
                .from('orders')
                .select('date')
                .eq('customer_id', customer.id)
                .order('date', { ascending: false })
                .limit(1)
                .single();
            
            if (orderError && orderError.code !== 'PGRST116') continue; // Ignore no rows found

            if (!lastOrder || new Date(lastOrder.date) < sixtyDaysAgo) {
                rawInsights.push({
                    type: 'inactive_customer',
                    customerName: customer.name,
                    daysSinceLastOrder: lastOrder ? Math.floor((new Date().getTime() - new Date(lastOrder.date).getTime()) / (1000 * 3600 * 24)) : null
                });
            }
        }
    }

    if (rawInsights.length === 0) {
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ insights: [] }) };
    }

    // 3. Generate human-readable insights with Gemini using a JSON schema
    const ai = new GoogleGenAI({ apiKey });

    const aiInsightSchema = {
      type: Type.ARRAY,
      items: {
          type: Type.OBJECT,
          properties: {
              message: {
                  type: Type.STRING,
                  description: "The human-readable insight or warning message in Ukrainian, including relevant emojis.",
              },
              severity: {
                  type: Type.STRING,
                  enum: ["warning", "info"],
                  description: "'warning' for critical issues like low stock, 'info' for opportunities like inactive customers.",
              },
          },
          required: ["message", "severity"],
      },
    };

    const prompt = `You are a business intelligence assistant for a cosmetics company. Analyze the following raw data points and convert them into a JSON array of short, actionable insights for the business owner. Respond ONLY with the JSON array that matches the provided schema. Use Ukrainian language for the messages. Use emojis to draw attention.

- For 'low_stock' items, create a 'warning' insight. Example: "⚠️ Увага: запаси товару 'Product Name' закінчуються. Залишилось X шт."
- For 'inactive_customer' items, create an 'info' insight. Example: "📈 Можливість: Клієнт 'Customer Name' не робив замовлень вже X днів. Варто запропонувати знижку."

Raw Data:
${JSON.stringify(rawInsights.slice(0, 5), null, 2)} 

Your JSON response:`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: aiInsightSchema,
        },
    });

    let insightsArray: { message: string; severity: 'warning' | 'info' }[] = [];
    try {
        const responseText = response.text;
        if (typeof responseText === 'string') {
            insightsArray = JSON.parse(responseText.trim() || '[]');
        }
    } catch (e) {
        console.error("Failed to parse JSON response from Gemini:", response.text);
        throw new Error("AI service returned an invalid response.");
    }
    
    // Add the 'type' property which is not part of the AI response for simplicity
    const generatedInsights: AIInsight[] = insightsArray.map((insight) => ({
        ...insight,
        type: insight.severity === 'warning' ? 'low_stock' : 'inactive_customer',
    }));
    
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ insights: generatedInsights }) };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return {
        statusCode: error.statusCode,
        headers: commonHeaders,
        body: JSON.stringify({ message: error.message }),
      };
    }
    console.error('Error in netlify/functions/aiInsights.ts:', error);
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: error.message || 'An unexpected error occurred while generating AI insights.' }) };
  }
};

export { handler };