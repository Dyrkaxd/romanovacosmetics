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
    salonPrice: dbProduct.salon_price === null ? 0 : dbProduct.salon_price,
    exchangeRate: dbProduct.exchange_rate === null ? 0 : dbProduct.exchange_rate,
    quantity: dbProduct.quanity === null ? 0 : dbProduct.quanity,
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
          const currentPage = parseInt(page, 10);
          const size = parseInt(pageSize, 10);
          const from = (currentPage - 1) * size;
          const to = from + size - 1;

          const allProductsPromises = Object.entries(productGroups).map(async ([group, tableName]) => {
            let query = supabase
              .from(tableName)
              .select('id, name, price, salon_price, exchange_rate, quanity, created_at');
            
            if (search) {
              query = query.ilike('name', `%${search}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Error searching in table ${tableName}:`, error);
                return []; // Return empty array for this table on error
            }
            return (data || []).map(p => transformDbRowToProduct(p as ProductDbRow, group as ProductGroupName))
          });

          const productsByGroup = await Promise.all(allProductsPromises);
          let allProducts = productsByGroup.flat();
          allProducts.sort((a,b) => (a.name || '').localeCompare(b.name || ''));

          const totalCount = allProducts.length;
          const paginatedData = allProducts.slice(from, to + 1);
          
          const response: PaginatedResponse<Product> = {
            data: paginatedData,
            totalCount,
            currentPage,
            pageSize: size,
          };
          
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(response) };
        }

      case 'POST':
        if (user.role !== 'admin') {
          return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Only administrators can modify products.' }) };
        }
        
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
            quanity: clientData.quantity ?? 0,
        };
        const { data: createdData, error: createError } = await supabase
            .from(tableName)
            .insert(newProductData)
            .select()
            .single();
        if (createError) throw createError;
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(createdData as ProductDbRow, group)) };

      case 'PUT':
        if (user.role !== 'admin') {
          return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Only administrators can modify products.' }) };
        }

        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Product ID required' }) };
        
        const findResultPut = await findProductById(resourceId);
        if (!findResultPut) {
          return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product to update not found.' }) };
        }
        
        const clientUpdateData = JSON.parse(event.body || '{}') as Partial<Product>;
        const productDataToUpdate: Partial<ProductDbRow> = {};
        if (clientUpdateData.name !== undefined) productDataToUpdate.name = clientUpdateData.name;
        if (clientUpdateData.retailPrice !== undefined) productDataToUpdate.price = clientUpdateData.retailPrice;
        if (clientUpdateData.salonPrice !== undefined) productDataToUpdate.salon_price = clientUpdateData.salonPrice;
        if (clientUpdateData.exchangeRate !== undefined) productDataToUpdate.exchange_rate = clientUpdateData.exchangeRate;
        if (clientUpdateData.quantity !== undefined) productDataToUpdate.quanity = clientUpdateData.quantity;

        const { data: updatedData, error: updateError } = await supabase
            .from(findResultPut.tableName)
            .update(productDataToUpdate)
            .eq('id', resourceId)
            .select()
            .single();
        if (updateError) throw updateError;
        if (!updatedData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product not found or failed to update' })};
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(updatedData as ProductDbRow, findResultPut.group)) };

      case 'DELETE':
        if (user.role !== 'admin') {
          return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Only administrators can modify products.' }) };
        }
        
        if (resourceId) {
          // Single Delete
          const findResult = await findProductById(resourceId);
          if (!findResult) {
            return { statusCode: 204, headers: commonHeaders, body: "" };
          }
          const { error: deleteError } = await supabase.from(findResult.tableName).delete().eq('id', resourceId);
          if (deleteError) {
            if (deleteError.code === '23503') { // foreign key violation
              return { statusCode: 409, headers: commonHeaders, body: JSON.stringify({ message: 'Неможливо видалити цей товар, оскільки він є частиною існуючих замовлень.' }) };
            }
            throw deleteError;
          }
          return { statusCode: 204, headers: commonHeaders, body: "" };
        } else {
          // Bulk Delete
          const { ids } = JSON.parse(event.body || '{}');
          if (!Array.isArray(ids) || ids.length === 0) {
            return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'An array of product IDs is required.' }) };
          }
          
          let totalDeletedCount = 0;
          let hadForeignKeyError = false;
          let otherErrors: string[] = [];

          const deletePromises = Object.values(productGroups).map(tableName =>
            supabase.from(tableName).delete().in('id', ids)
          );
          const results = await Promise.allSettled(deletePromises);

          results.forEach(result => {
              if (result.status === 'fulfilled') {
                  const { count, error } = result.value;
                  if (error) {
                      if (error.code === '23503') {
                          hadForeignKeyError = true;
                      } else {
                          otherErrors.push(error.message);
                      }
                  }
                  if (count) {
                      totalDeletedCount += count;
                  }
              } else { // rejected
                  otherErrors.push(result.reason.message);
              }
          });

          let message = `Успішно видалено ${totalDeletedCount} товар(ів).`;
          if (hadForeignKeyError) {
              message += ` Деякі товари не вдалося видалити, оскільки вони є частиною існуючих замовлень.`
          }
          if (otherErrors.length > 0) {
              message += ` Під час видалення сталися додаткові помилки.`
              console.error("Bulk delete errors:", otherErrors);
          }
          
          if (totalDeletedCount === 0 && (hadForeignKeyError || otherErrors.length > 0)) {
             return { statusCode: 409, headers: commonHeaders, body: JSON.stringify({ message: 'Не вдалося видалити обрані товари. Вони можуть бути частиною існуючих замовлень.' }) };
          }

          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ message }) };
        }

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