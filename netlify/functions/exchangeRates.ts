
import { Handler, HandlerEvent } from '@netlify/functions';
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
type ProductGroupName = keyof typeof productGroups;

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    const user = await requireAuth(event);
    if (user.role !== 'admin') {
      return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Administrator access required.' }) };
    }

    const { newRate, group } = JSON.parse(event.body || '{}');
    if (typeof newRate !== 'number' || newRate <= 0) {
      return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Invalid exchange rate provided. Must be a positive number.' }) };
    }

    let tablesToUpdate: string[] = [];
    if (group) {
      const tableName = productGroups[group as ProductGroupName];
      if (!tableName) {
        return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: `Invalid product group: ${group}` }) };
      }
      tablesToUpdate.push(tableName);
    } else {
      tablesToUpdate = Object.values(productGroups);
    }
    
    let totalUpdatedCount = 0;

    const updatePromises = tablesToUpdate.map(tableName =>
      supabase
        .from(tableName)
        .update({ exchange_rate: newRate })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Dummy condition to update all rows
        .then(({ count, error }) => {
          if (error) throw error;
          totalUpdatedCount += (count || 0);
        })
    );
    
    await Promise.all(updatePromises);

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'Exchange rates updated successfully.', updatedCount: totalUpdatedCount }),
    };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in exchangeRates function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
    };
  }
};

export { handler };