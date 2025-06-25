
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Define commonHeaders locally for this simplified test
const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // THIS IS THE MOST IMPORTANT LOG. If this doesn't appear in Netlify Function logs,
  // the function isn't even starting correctly.
  console.log('[SIMPLIFIED_MANAGED_USERS_TEST] Function invoked. HTTP Method:', event.httpMethod);

  if (event.httpMethod === 'OPTIONS') {
    console.log('[SIMPLIFIED_MANAGED_USERS_TEST] Responding to OPTIONS request.');
    return {
      statusCode: 204,
      headers: commonHeaders,
      body: '',
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      const emailToQuery = event.queryStringParameters?.email;
      console.log(`[SIMPLIFIED_MANAGED_USERS_TEST] GET request. Email query: ${emailToQuery}`);

      if (emailToQuery === 'manager@example.com') {
        const mockManager = {
          id: 'test-manager-id-123',
          name: 'Тестовий Менеджер (з функції)',
          email: 'manager@example.com',
          notes: 'Це тестовий менеджер зі спрощеної функції.',
          created_at: new Date().toISOString(),
          added_by_admin_email: 'admin@example.com'
        };
        console.log('[SIMPLIFIED_MANAGED_USERS_TEST] Returning mock manager for email:', emailToQuery);
        return {
          statusCode: 200,
          headers: commonHeaders,
          body: JSON.stringify(mockManager),
        };
      }

      const mockUserList = [
        {
          id: 'test-id-1',
          name: 'Тестовий Користувач 1 (спрощено)',
          email: 'test1@example.com',
          notes: 'Нотатки для користувача 1',
          created_at: new Date().toISOString(),
          added_by_admin_email: 'admin@example.com'
        },
        {
          id: 'test-id-2',
          name: 'Тестовий Користувач 2 (спрощено)',
          email: 'test2@example.com',
          notes: null,
          created_at: new Date().toISOString(),
          added_by_admin_email: 'admin@example.com'
        },
      ];
      console.log('[SIMPLIFIED_MANAGED_USERS_TEST] Returning mock user list.');
      return {
        statusCode: 200,
        headers: commonHeaders,
        body: JSON.stringify(mockUserList),
      };
    }

    console.log(`[SIMPLIFIED_MANAGED_USERS_TEST] Method ${event.httpMethod} not allowed in simplified test.`);
    return {
      statusCode: 405,
      headers: commonHeaders,
      body: JSON.stringify({ message: `Method ${event.httpMethod} Not Allowed in simplified test` }),
    };

  } catch (error: any) {
    console.error('[SIMPLIFIED_MANAGED_USERS_TEST] Error in handler:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'Error in simplified test function: ' + error.message }),
    };
  }
};

export { handler };
