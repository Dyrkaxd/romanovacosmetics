


import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import type { Product, PaginatedResponse } from '../../types';
import type { Database } from '../../types/supabase';
import { requireAuth } from '../utils/auth';

// A generic type for any of the product table rows.
type ProductDbRow = Database['public']['Tables']['products_bdr']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Mapping from user-facing group names to database table names.
const productGroups = {
  'BDR': 'products_bdr',
  'LA': 'products_la',
  'АГ': 'products_ag',
  'АБ': 'products_ab_cyr',
  'АР': 'products_ar_cyr',
  'без сокращений': 'products_bez_sokr',
  'АФ': 'products_af',
  'ДС': 'products_ds',
  'м8': 'products_m8',
  'JDA': 'products_jda',
  'Faith': 'products_faith',
  'AB': 'products_ab_lat',
  'ГФ': 'products_gf',
  'ЕС': 'products_es',
  'ГП': 'products_gp',
  'СД': 'products_sd',
  'ATA': 'products_ata',
  'W': 'products_w',
};
type ProductGroupName = keyof typeof productGroups;
type ProductTableName = typeof productGroups[ProductGroupName];


const transformDbRowToProduct = (dbProduct: ProductDbRow, group: ProductGroupName): Product => {
  return {
    id: dbProduct.id,
    group,
    name: dbProduct.name,
    retailPrice: dbProduct.price,
    salonPrice: dbProduct.salon_price === null ? 0 : dbProduct.salon_price,
    exchangeRate: dbProduct.exchange_rate === null ? 0 : dbProduct.exchange_rate,
    quantity: dbProduct.quantity === null ? 0 : dbProduct.quantity,
    created_at: dbProduct.created_at || undefined,
  };
};

// Helper to find a product across all tables
const findProductById = async (id: string): Promise<{ product: ProductDbRow, tableName: ProductTableName, group: ProductGroupName } | null> => {
  for (const [group, tableName] of Object.entries(productGroups)) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') { // Ignore "no rows found"
      throw error;
    }
    if (data) {
      return { product: data as ProductDbRow, tableName: tableName as ProductTableName, group: group as ProductGroupName };
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

    const pathParts = event.path.split('/').filter(Boolean);
    const resourceId = pathParts.length > 2 ? pathParts[2] : null;

    switch (event.httpMethod) {
      case 'GET':
        if (resourceId) {
          const findResult = await findProductById(resourceId);
          if (!findResult) {
            return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product not found'}) };
          }
          const product = transformDbRowToProduct(findResult.product, findResult.group);
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(product) };
        } else {
          // Logic for fetching multiple products (list view / search)
          const { search = '', page = '1', pageSize = '20' } = event.queryStringParameters || {};
          const size = parseInt(pageSize, 10);

          // IMPORTANT: To prevent timeouts and performance issues, we now require a search term
          // to fetch products for a list. A call without a search term will return empty.
          if (!search) {
             const emptyResponse: PaginatedResponse<Product> = {
                data: [],
                totalCount: 0,
                currentPage: 1,
                pageSize: size,
             };
             return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(emptyResponse) };
          }
          
          // Limit search result size for dropdowns, etc.
          const searchLimitPerTable = 15;

          const allProductsPromises = Object.entries(productGroups).map(async ([group, tableName]) => {
            const { data, error } = await supabase
              .from(tableName)
              .select('id, name, price, salon_price, exchange_rate, quantity, created_at')
              .ilike('name', `%${search}%`)
              .limit(searchLimitPerTable);

            if (error) {
                console.error(`Error searching in table ${tableName}:`, error);
                return []; // Return empty array for this table on error
            }
            return (data || []).map(p => transformDbRowToProduct(p as ProductDbRow, group as ProductGroupName));
          });

          const productsByGroup = await Promise.all(allProductsPromises);
          const allProducts = productsByGroup.flat().sort((a,b) => (a.name || '').localeCompare(b.name || ''));

          // Because we search across many tables, true pagination is complex.
          // We return a combined list of top results. The frontend will not paginate this specific search.
          const response: PaginatedResponse<Product> = {
            data: allProducts,
            totalCount: allProducts.length,
            currentPage: 1,
            pageSize: allProducts.length,
          };
          
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(response) };
        }

      case 'POST':
      case 'PUT':
      case 'DELETE':
        if (user.role !== 'admin') {
          return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Only administrators can modify products.' }) };
        }
        
        if (event.httpMethod === 'POST') {
          const clientData = JSON.parse(event.body || '{}') as Partial<Product>;
          const group = clientData.group as ProductGroupName;
          const tableName = productGroups[group];
          if (!tableName) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: `Invalid product group: ${group}` }) };
          }
          
          const newProductData = {
              name: clientData.name,
              price: clientData.retailPrice,
              salon_price: clientData.salonPrice,
              exchange_rate: clientData.exchangeRate,
              quantity: clientData.quantity ?? 0,
          };
          const { data: createdData, error: createError } = await supabase
              .from(tableName)
              .insert(newProductData)
              .select()
              .single();
          if (createError) throw createError;
          return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(createdData as ProductDbRow, group)) };
        }
        
        if (event.httpMethod === 'PUT') {
          if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Product ID required' }) };
          
          const findResult = await findProductById(resourceId);
          if (!findResult) {
            return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product to update not found.' }) };
          }
          
          const clientUpdateData = JSON.parse(event.body || '{}') as Partial<Product>;
          const productDataToUpdate: Partial<ProductDbRow> = {};
          if (clientUpdateData.name !== undefined) productDataToUpdate.name = clientUpdateData.name;
          if (clientUpdateData.retailPrice !== undefined) productDataToUpdate.price = clientUpdateData.retailPrice;
          if (clientUpdateData.salonPrice !== undefined) productDataToUpdate.salon_price = clientUpdateData.salonPrice;
          if (clientUpdateData.exchangeRate !== undefined) productDataToUpdate.exchange_rate = clientUpdateData.exchangeRate;
          if (clientUpdateData.quantity !== undefined) productDataToUpdate.quantity = clientUpdateData.quantity;

          const { data: updatedData, error: updateError } = await supabase
              .from(findResult.tableName)
              .update(productDataToUpdate)
              .eq('id', resourceId)
              .select()
              .single();
          if (updateError) throw updateError;
          if (!updatedData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product not found or failed to update' })};
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(updatedData as ProductDbRow, findResult.group)) };
        }

        if (event.httpMethod === 'DELETE') {
          if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Product ID required' }) };
          
          const findResult = await findProductById(resourceId);
          if (!findResult) {
            // If it's not found, maybe it was already deleted. Return success.
            return { statusCode: 204, headers: commonHeaders, body: '' };
          }

          const { error: deleteError } = await supabase.from(findResult.tableName).delete().eq('id', resourceId);
          if (deleteError) throw deleteError;
          return { statusCode: 204, headers: commonHeaders, body: '' };
        }
        break; 

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return {
        statusCode: error.statusCode,
        headers: commonHeaders,
        body: JSON.stringify({ message: error.message }),
      };
    }
    console.error('Error in netlify/functions/products.ts:', error);
    const message = typeof error.message === 'string' ? error.message : 'An unexpected error occurred.';
    const details = typeof error.details === 'string' ? error.details : undefined;
    const hint = typeof error.hint === 'string' ? error.hint : undefined;
    let statusCode = 500;
    if (error?.code?.startsWith('PGRST')) {
      statusCode = 400;
    } else if (error?.status) {
      statusCode = error.status;
    }
    return {
      statusCode,
      headers: commonHeaders,
      body: JSON.stringify({ message, ...(details && { details }), ...(hint && { hint }) }),
    };
  }
};

export { handler };