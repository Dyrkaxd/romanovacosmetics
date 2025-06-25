
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Define commonHeaders locally for this simplified test
const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // THIS IS THE MOST IMPORTANT LOG for this test.
  console.log('[SIMPLIFIED_PRODUCTS_TEST] Function invoked. HTTP Method:', event.httpMethod, 'Path:', event.path);

  if (event.httpMethod === 'OPTIONS') {
    console.log('[SIMPLIFIED_PRODUCTS_TEST] Responding to OPTIONS request.');
    return {
      statusCode: 204,
      headers: commonHeaders,
      body: '',
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      console.log('[SIMPLIFIED_PRODUCTS_TEST] GET request processing.');
      const mockProducts = [
        { id: 'test-prod-1', name: 'Тестовий Товар 1 (спрощено)', price: 10.99, description: 'Опис 1', imageUrl: '', created_at: new Date().toISOString() },
        { id: 'test-prod-2', name: 'Тестовий Товар 2 (спрощено)', price: 25.50, description: 'Опис 2', imageUrl: '', created_at: new Date().toISOString() },
      ];
      return {
        statusCode: 200,
        headers: commonHeaders,
        body: JSON.stringify(mockProducts),
      };
    }

    if (event.httpMethod === 'POST') {
        console.log('[SIMPLIFIED_PRODUCTS_TEST] POST request processing. Body:', event.body);
        const newProduct = JSON.parse(event.body || '{}');
        const mockCreatedProduct = {
            id: 'test-prod-new-' + Date.now(),
            ...newProduct,
            name: newProduct.name || "Новий Тестовий Товар",
            price: newProduct.price || 0,
            created_at: new Date().toISOString()
        };
         return {
            statusCode: 201, // Created
            headers: commonHeaders,
            body: JSON.stringify(mockCreatedProduct),
        };
    }
    
    // Add simple handlers for PUT and DELETE if you want to test those paths
    // For now, other methods will fall through to 405

    console.log(`[SIMPLIFIED_PRODUCTS_TEST] Method ${event.httpMethod} not allowed in simplified test or not handled.`);
    return {
      statusCode: 405,
      headers: commonHeaders,
      body: JSON.stringify({ message: `Method ${event.httpMethod} Not Allowed in simplified test` }),
    };

  } catch (error: any) {
    console.error('[SIMPLIFIED_PRODUCTS_TEST] Error in handler:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'Error in simplified products test function: ' + error.message }),
    };
  }
};

export { handler };
