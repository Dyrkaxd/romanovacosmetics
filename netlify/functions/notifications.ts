import { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth, AuthError, isMissingTableError } from '../utils/auth';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const user = await requireAuth(event);

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false })
        .limit(15);

      if (isMissingTableError(error)) {
        console.warn("Notifications table seems to be missing. Returning empty array.");
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify([]) };
      }
      if (error) throw error;
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(data || []) };
    }

    if (event.httpMethod === 'POST') {
      const path = event.path.split('/').pop();
      if (path === 'mark-read') {
        const { ids } = JSON.parse(event.body || '{}');
        if (!Array.isArray(ids) || ids.length === 0) {
          return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Notification IDs must be a non-empty array.' }) };
        }

        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', ids)
          .eq('user_email', user.email);
        
        if (isMissingTableError(error)) {
            console.warn("Notifications table seems to be missing. Cannot mark as read.");
            return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ message: 'No notifications to mark as read.' }) };
        }
        if (error) throw error;
        return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ message: 'Notifications marked as read.' }) };
      }
    }

    return { statusCode: 405, headers: commonHeaders, body: JSON.stringify({ message: 'Method Not Allowed' }) };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return {
        statusCode: error.statusCode,
        headers: commonHeaders,
        body: JSON.stringify({ message: error.message }),
      };
    }
    
    if (isMissingTableError(error)) {
        const message = `Database setup error: The 'notifications' table appears to be missing. Please run the setup SQL script in your Supabase dashboard.`;
        console.error(message, error);
        return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message }) };
    }

    console.error('Error in notifications function:', error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
    };
  }
};

export { handler };