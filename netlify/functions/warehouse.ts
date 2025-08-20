
import { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import type { Product } from '../../types';
import type { Database } from '../../types/supabase';
import { requireAuth } from '../utils/auth';

type ProductDbRow = Database['public']['Tables']['products_bdr']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
type ProductTableName = typeof productGroups[ProductGroupName];

const transformDbRowToProduct = (dbProduct: ProductDbRow, group: ProductGroupName): Product => {
  return {
    id: dbProduct.id,
    group,
    name: dbProduct.name,
    retailPrice: dbProduct.price,
    salonPrice: dbProduct.salon_price ?? 0,
    exchangeRate: dbProduct.exchange_rate ?? 0,
    quantity: dbProduct.quanity ?? 0,
    created_at: dbProduct.created_at || undefined,
  };
};

const findProductById = async (id: string): Promise<{ product: ProductDbRow, tableName: ProductTableName } | null> => {
  for (const tableName of Object.values(productGroups)) {
    const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') { // Ignore "no rows found"
      throw error;
    }
    if (data) {
      return { product: data as ProductDbRow, tableName: tableName as ProductTableName };
    }
  }
  return null;
};

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const user = await requireAuth(event);
    if (user.role !== 'admin') {
      return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Admin access required.' }) };
    }

    const pathParts = event.path.split('/').filter(Boolean);
    const resourceId = pathParts.length > 2 ? pathParts[2] : null;

    switch (event.httpMethod) {
      case 'GET':
        const allProductsPromises = Object.entries(productGroups).map(async ([group, tableName]) => {
          const { data, error } = await supabase.from(tableName).select('id, name, quanity, created_at');
          if (error) {
            console.error(`Error fetching from table ${tableName}:`, error);
            return [];
          }
          return (data || []).map(p => ({
            id: p.id,
            name: p.name,
            group: group,
            quantity: p.quanity ?? 0,
            created_at: p.created_at,
          }));
        });
        
        const productsByGroup = await Promise.all(allProductsPromises);
        const allProducts = productsByGroup.flat().sort((a,b) => (a.name || '').localeCompare(b.name || ''));
        
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ data: allProducts }) };

      case 'PUT':
        if (!resourceId) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Product ID is required.' }) };
        }
        const { quantity } = JSON.parse(event.body || '{}');
        if (typeof quantity !== 'number' || quantity < 0) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'A valid, non-negative quantity is required.' }) };
        }

        const findResult = await findProductById(resourceId);
        if (!findResult) {
          return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product not found.' }) };
        }

        const { data, error } = await supabase
          .from(findResult.tableName)
          .update({ quanity: quantity })
          .eq('id', resourceId)
          .select()
          .single();
        
        if (error) throw error;
        
        const groupName = Object.keys(productGroups).find(key => productGroups[key as ProductGroupName] === findResult.tableName) as ProductGroupName;
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(data as ProductDbRow, groupName)) };

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in warehouse function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
    };
  }
};

export { handler };