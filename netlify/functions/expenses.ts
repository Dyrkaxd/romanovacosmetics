import { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import type { Expense, PaginatedResponse } from '../../types';
import type { Database } from '../../types/supabase';
import { requireAuth } from '../utils/auth';

type ExpenseDbRow = Database['public']['Tables']['expenses']['Row'];

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const transformDbRowToExpense = (dbExpense: ExpenseDbRow): Expense => ({
  id: dbExpense.id,
  name: dbExpense.name,
  amount: dbExpense.amount,
  date: dbExpense.date,
  notes: dbExpense.notes || undefined,
  created_at: dbExpense.created_at,
  created_by_user_email: dbExpense.created_by_user_email || undefined,
});

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const user = await requireAuth(event);
    if (user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: commonHeaders,
        body: JSON.stringify({ message: 'Forbidden: Administrator access is required.' }),
      };
    }

    const pathParts = event.path.split('/').filter(Boolean);
    const resourceId = pathParts.length > 2 ? pathParts[2] : null;

    switch (event.httpMethod) {
      case 'GET': {
        const { page = '1', pageSize = '20', search = '' } = event.queryStringParameters || {};
        const currentPage = parseInt(page, 10);
        const size = parseInt(pageSize, 10);
        const from = (currentPage - 1) * size;
        const to = from + size - 1;

        const query = supabase.from('expenses').select('*', { count: 'exact' });

        if (search) {
          query.or(`name.ilike.%${search}%,notes.ilike.%${search}%`);
        }

        const { data: dbData, error, count } = await query
          .order('date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const expenses = (dbData || []).map(transformDbRowToExpense);
        const response: PaginatedResponse<Expense> = {
          data: expenses,
          totalCount: count || 0,
          currentPage,
          pageSize: size,
        };

        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(response) };
      }

      case 'POST': {
        const { name, amount, date, notes } = JSON.parse(event.body || '{}');
        if (!name || !amount || !date) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Name, amount, and date are required.' }) };
        }

        const { data, error } = await supabase
          .from('expenses')
          .insert({ name, amount, date, notes, created_by_user_email: user.email })
          .select()
          .single();

        if (error) throw error;
        return { statusCode: 201, headers: commonHeaders, body: JSON.stringify(transformDbRowToExpense(data)) };
      }

      case 'PUT': {
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Expense ID required' }) };
        const { name, amount, date, notes } = JSON.parse(event.body || '{}');
        const dataToUpdate: Partial<ExpenseDbRow> = {};
        if (name) dataToUpdate.name = name;
        if (amount) dataToUpdate.amount = amount;
        if (date) dataToUpdate.date = date;
        dataToUpdate.notes = notes; // Allow setting notes to null

        const { data, error } = await supabase.from('expenses').update(dataToUpdate).eq('id', resourceId).select().single();
        if (error) throw error;
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(transformDbRowToExpense(data)) };
      }

      case 'DELETE': {
        if (!resourceId) return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Expense ID required' }) };
        const { error } = await supabase.from('expenses').delete().eq('id', resourceId);
        if (error) throw error;
        return { statusCode: 204, headers: commonHeaders, body: '' };
      }

      default:
        return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }
  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in expenses function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
    };
  }
};

export { handler };