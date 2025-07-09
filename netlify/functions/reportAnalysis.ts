

import { Handler } from '@netlify/functions';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { requireAuth } from '../utils/auth';
import type { ReportData } from '../../types';

const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
};

const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: commonHeaders, body: '' };
    }

    try {
        const user = await requireAuth(event);
        if (user.role !== 'admin') {
            return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Admin access required.' }) };
        }

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed.' }) };
        }

        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error('API_KEY for Gemini is not set in environment variables for reportAnalysis function.');
            return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'AI service configuration error.' }) };
        }

        const reportData: ReportData = JSON.parse(event.body || '{}');
        
        // Prune data for a more effective and efficient prompt
        const compactData = {
            totalRevenue: reportData.totalRevenue,
            grossProfit: reportData.grossProfit,
            totalExpenses: reportData.totalExpenses,
            netProfit: reportData.totalProfit,
            totalOrders: reportData.totalOrders,
            top_3_products_by_revenue: reportData.topProducts.slice(0, 3).map(p => p.productName),
            top_revenue_group: reportData.revenueByGroup.length > 0 ? reportData.revenueByGroup[0].group : 'N/A'
        };

        const prompt = `Ти досвідчений бізнес-аналітик для компанії косметики. Проаналізуй наступні зведені дані звіту про продажі. Надай короткий, але глибокий аналіз (2-3 речення, українською мовою). Твій аналіз повинен оцінити чисту прибутковість, враховуючи доходи та витрати. Виділи ключові моменти та запропонуй одну дієву пораду для збільшення чистого прибутку.

Зведені дані звіту:
${JSON.stringify(compactData, null, 2)}

Твій AI-аналіз звіту:`;

        const ai = new GoogleGenAI({ apiKey });

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        const summaryText = response.text;

        if (!summaryText) {
            console.error('Gemini API returned no text for report analysis.');
            return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'AI service failed to generate analysis.' }) };
        }

        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ analysis: summaryText.trim() }) };

    } catch (error: any) {
        if (error.statusCode) { // AuthError
            return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
        }
        console.error('Error in reportAnalysis function:', error);
        return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: 'Server error while generating AI analysis.' }) };
    }
};

export { handler };