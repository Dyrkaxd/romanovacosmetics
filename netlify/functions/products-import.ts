import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const productGroups = {
  'BDR': 'products_bdr', 'LA': 'products_la', 'АГ': 'products_ag', 'АБ': 'products_ab_cyr',
  'АР': 'products_ar_cyr', 'без сокращений': 'products_bez_sokr', 'АФ': 'products_af',
  'ДС': 'products_ds', 'м8': 'products_m8', 'JDA': 'products_jda', 'Faith': 'products_faith',
  'AB': 'products_ab_lat', 'ГФ': 'products_gf', 'ЕС': 'products_es', 'ГП': 'products_gp',
  'СД': 'products_sd', 'ATA': 'products_ata', 'W': 'products_w',
};

const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: commonHeaders, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const user = await requireAuth(event);
        if (user.role !== 'admin') {
            return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Administrator access required.' }) };
        }

        const productsToImport = JSON.parse(event.body || '[]') as { name: string; group: string; retailPrice: number; salonPrice: number; exchangeRate: number; }[];
        if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'No products to import.' }) };
        }

        const productsByGroup = productsToImport.reduce((acc, p) => {
            if (!acc[p.group]) acc[p.group] = [];
            acc[p.group].push({
                name: p.name,
                price: p.retailPrice,
                salon_price: p.salonPrice,
                exchange_rate: p.exchangeRate,
                // Quantity is intentionally omitted to avoid overwriting existing stock levels for updated products.
                // New products will get the default quantity (0 or NULL) from the database.
            });
            return acc;
        }, {} as Record<string, any[]>);

        let totalUpsertedCount = 0;
        const errors: string[] = [];

        for (const groupName in productsByGroup) {
            const tableName = productGroups[groupName as keyof typeof productGroups];
            if (!tableName) {
                errors.push(`Невірна група '${groupName}' для деяких товарів.`);
                continue;
            }

            const { count, error } = await supabase
                .from(tableName)
                .upsert(productsByGroup[groupName], { onConflict: 'name' }); // Assumes unique constraint on 'name' per table

            if (error) {
                console.error(`Error upserting to ${tableName}:`, error);
                errors.push(`Помилка при імпорті в групу '${groupName}': ${error.message}`);
            } else {
                totalUpsertedCount += count || 0;
            }
        }
        
        if (errors.length > 0) {
             const errorMessage = `Імпорт частково не вдався. Оброблено: ${totalUpsertedCount}. Помилки: ${errors.join('; ')}`;
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: JSON.stringify({ message: errorMessage })
            };
        }

        return {
            statusCode: 200,
            headers: commonHeaders,
            body: JSON.stringify({ message: `Успішно оброблено ${totalUpsertedCount} товарів.` })
        };

    } catch (error: any) {
        if (error.statusCode) { // AuthError
            return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
        }
        console.error('Error in products-import function:', error);
        return {
            statusCode: 500,
            headers: commonHeaders,
            body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
        };
    }
};

export { handler };