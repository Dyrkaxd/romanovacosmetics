
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient'; // Adjusted path
import type { Product } from '../../types'; // Assuming types are correctly defined
import type { Database } from '../../types/supabase';

type ProductDbRow = Database['public']['Tables']['products']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Helper to transform DB row to client-side Product type if needed (e.g. date formatting)
// For Product, it's mostly direct mapping, but good practice if transformations are needed.
const transformDbRowToProduct = (dbProduct: ProductDbRow): Product => {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    price: dbProduct.price,
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
            .select('*')
            .eq('id', resourceId)
            .single();
          if (error) throw error;
          if (!data) return { statusCode: 404, headers: commonHeaders, body: JSON.stringify({ message: 'Product not found'}) };
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(data as ProductDbRow)) };
        } else {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const products = (data as ProductDbRow[] || []).map(transformDbRowToProduct);
          return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(products) };
        }

      case 'POST':
        const newProductData = JSON.parse(event.body || '{}') as Partial<Product>;
        // Ensure price is a number
        if (typeof newProductData.price === 'string') {
            newProductData.price = parseFloat(newProductData.price);
        }
        const { data: createdData, error: createError } = await supabase.from('products').insert(newProductData).select().single();
        if (createError) throw createError;
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(transformDbRowToProduct(createdData as ProductDbRow)) };

      case 'PUT':
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Product ID required' }) };
        const updatedProductData = JSON.parse(event.body || '{}') as Partial<Product>;
        // Ensure price is a number if provided
        if (updatedProductData.price !== undefined && typeof updatedProductData.price === 'string') {
            updatedProductData.price = parseFloat(updatedProductData.price);
        }
        delete updatedProductData.id; // ID should not be updated

        const { data: updatedData, error: updateError } = await supabase.from('products').update(updatedProductData).eq('id', resourceId).select().single();
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
