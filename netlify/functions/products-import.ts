
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
  'Гуаша': 'products_guasha',
};

// Map of common variations to the canonical group name
const groupNameMap: Record<string, keyof typeof productGroups> = {
    'la': 'LA',
    'bez_sokr': 'без сокращений',
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
            let groupKey = p.group;
            // Normalize group name
            const normalizedKey = groupNameMap[groupKey.toLowerCase()];
            if (normalizedKey) {
                groupKey = normalizedKey;
            }

            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push({
                name: p.name,
                price: p.retailPrice,
                salon_price: p.salonPrice,
                exchange_rate: p.exchangeRate,
            });
            return acc;
        }, {} as Record<string, any[]>);

        let totalUpdatedCount = 0;
        let totalInsertedCount = 0;
        const errors: string[] = [];

        for (const groupName in productsByGroup) {
            const tableName = productGroups[groupName as keyof typeof productGroups];
            if (!tableName) {
                errors.push(`Невірна група '${groupName}' для деяких товарів.`);
                continue;
            }

            const productsForThisGroup = productsByGroup[groupName];
            const productNames = productsForThisGroup.map(p => p.name);

            const { data: existingProducts, error: fetchError } = await supabase
                .from(tableName)
                .select('id, name')
                .in('name', productNames);

            if (fetchError) {
                errors.push(`Помилка отримання існуючих товарів для групи '${groupName}': ${fetchError.message}`);
                continue;
            }

            const existingProductsMap = new Map((existingProducts || []).map(p => [p.name, p.id]));
            const toInsert: any[] = [];
            const toUpdate: any[] = [];

            for (const product of productsForThisGroup) {
                const existingId = existingProductsMap.get(product.name);
                if (existingId) {
                    toUpdate.push({ ...product, id: existingId });
                } else {
                    toInsert.push(product);
                }
            }

            if (toInsert.length > 0) {
                const { error: insertError } = await supabase.from(tableName).insert(toInsert);
                if (insertError) {
                    errors.push(`Помилка додавання нових товарів в групу '${groupName}': ${insertError.message}`);
                } else {
                    totalInsertedCount += toInsert.length;
                }
            }
            
            if (toUpdate.length > 0) {
                for (const product of toUpdate) {
                    const { id, ...updateData } = product;
                    const { error: updateError } = await supabase.from(tableName).update(updateData).eq('id', id);
                    if (updateError) {
                        errors.push(`Помилка оновлення товару '${product.name}': ${updateError.message}`);
                    } else {
                        totalUpdatedCount++;
                    }
                }
            }
        }
        
        const totalProcessedCount = totalInsertedCount + totalUpdatedCount;
        
        if (errors.length > 0) {
             const errorMessage = `Імпорт частково не вдався. Оброблено: ${totalProcessedCount}. Помилки: ${errors.join('; ')}`;
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: JSON.stringify({ message: errorMessage })
            };
        }

        return {
            statusCode: 200,
            headers: commonHeaders,
            body: JSON.stringify({ message: `Успішно оброблено ${totalProcessedCount} товарів (${totalInsertedCount} додано, ${totalUpdatedCount} оновлено).` })
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
