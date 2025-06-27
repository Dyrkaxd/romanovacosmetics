
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../services/supabaseClient'; // Adjusted path
import type { Product } from '../../types'; // Assuming types are correctly defined
import type { Database } from '../../types/supabase';

type ProductDbRow = Database['public']['Tables']['products']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const transformDbRowToProduct = (dbProduct: ProductDbRow): Product => {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    retailPrice: dbProduct.price, // DB 'price' is now retailPrice
    salonPrice: dbProduct.salon_price === null ? 0 : dbProduct.salon_price, // Default to 0 if null
    exchangeRate: dbProduct.exchange_rate === null ? 0 : dbProduct.exchange_rate, // Default to 0 if null
    description: dbProduct.description || '',
    imageUrl: dbProduct.image_url || undefined,
    created_at: dbProduct.created_at || undefined,
  };
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  const pathParts = event.path.split('/').filter(Boolean);
  const resourceId = pathParts.length > 2 ? pathParts[2] : null;

  try {
    switch (event.httpMethod) {
      case 'GET':
        if (resourceId) {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, price, salon_price, exchange_rate, description, image_url, created_at')
            .eq('id', resourceId)
            .single();
          if (error) throw error;
          if (!data) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product not found'}) };
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(data as ProductDbRow)) };
        } else {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, price, salon_price, exchange_rate, description, image_url, created_at')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const products = (data as ProductDbRow[] || []).map(transformDbRowToProduct);
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(products) };
        }

      case 'POST':
        const clientData = JSON.parse(event.body || '{}') as Partial<Product>;
        const newProductData = {
            name: clientData.name,
            price: typeof clientData.retailPrice === 'string' ? parseFloat(clientData.retailPrice) : clientData.retailPrice,
            salon_price: typeof clientData.salonPrice === 'string' ? parseFloat(clientData.salonPrice) : clientData.salonPrice,
            exchange_rate: typeof clientData.exchangeRate === 'string' ? parseFloat(clientData.exchangeRate) : clientData.exchangeRate,
            description: clientData.description,
            image_url: clientData.imageUrl,
        };
        
        const { data: createdData, error: createError } = await supabase
            .from('products')
            .insert(newProductData)
            .select()
            .single();
        if (createError) throw createError;
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(createdData as ProductDbRow)) };

      case 'PUT':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Product ID required' }) };
        const clientUpdateData = JSON.parse(event.body || '{}') as Partial<Product>;
        
        const productDataToUpdate: Partial<ProductDbRow> = {};
        if (clientUpdateData.name !== undefined) productDataToUpdate.name = clientUpdateData.name;
        if (clientUpdateData.retailPrice !== undefined) productDataToUpdate.price = typeof clientUpdateData.retailPrice === 'string' ? parseFloat(clientUpdateData.retailPrice) : clientUpdateData.retailPrice;
        if (clientUpdateData.salonPrice !== undefined) productDataToUpdate.salon_price = typeof clientUpdateData.salonPrice === 'string' ? parseFloat(clientUpdateData.salonPrice) : clientUpdateData.salonPrice;
        if (clientUpdateData.exchangeRate !== undefined) productDataToUpdate.exchange_rate = typeof clientUpdateData.exchangeRate === 'string' ? parseFloat(clientUpdateData.exchangeRate) : clientUpdateData.exchangeRate;
        if (clientUpdateData.description !== undefined) productDataToUpdate.description = clientUpdateData.description;
        if (clientUpdateData.imageUrl !== undefined) productDataToUpdate.image_url = clientUpdateData.imageUrl;

        const { data: updatedData, error: updateError } = await supabase
            .from('products')
            .update(productDataToUpdate)
            .eq('id', resourceId)
            .select()
            .single();
        if (updateError) throw updateError;
        if (!updatedData) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product not found or failed to update' })};
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(updatedData as ProductDbRow)) };

      case 'DELETE':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Product ID required' }) };
        const { error: deleteError } = await supabase.from('products').delete().eq('id', resourceId);
        if (deleteError) throw deleteError;
        return { statusCode: 204, headers: commonHeaders, body: '' };

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    console.error('Error in netlify/functions/products.ts:', error);
    const message = typeof error.message === 'string' ? error.message : 'An unexpected error occurred.';
    const details = typeof error.details === 'string' ? error.details : undefined;
    const hint = typeof error.hint === 'string' ? error.hint : undefined;
    
    let statusCode = 500;
    if (error && error.code && typeof error.code === 'string' && error.code.startsWith('PGRST')) {
      statusCode = 400; // Bad request related to PostgREST
    } else if (error && typeof error.status === 'number') {
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