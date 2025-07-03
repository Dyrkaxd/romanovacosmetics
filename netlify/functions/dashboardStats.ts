
import { Handler, HandlerEvent } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';
import type { ManagerStats } from '../../types';
import type { Database } from '../../types/supabase';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

type AdminRow = Database['public']['Tables']['admins']['Row'];
type ManagedUserDbRow = Database['public']['Tables']['managed_users']['Row'];

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
        body: JSON.stringify({ message: 'Forbidden: Administrator access required.' }),
      };
    }

    // 1. Fetch counts in parallel
    const countsPromises = [
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('managed_users').select('*', { count: 'exact', head: true }),
    ];

    const [
      { count: totalOrdersCount, error: ordersCountError },
      { count: totalCustomersCount, error: customersCountError },
      { count: totalManagersCount, error: managersCountError },
    ] = await Promise.all(countsPromises);

    if (ordersCountError) throw ordersCountError;
    if (customersCountError) throw customersCountError;
    if (managersCountError) throw managersCountError;

    // 2. Fetch all data needed for calculations
    const dataPromises = [
      supabase.from('orders').select('*, items:order_items(*)'),
      supabase.from('managed_users').select('*'),
      supabase.from('admins').select('*')
    ];
    
    const [
        { data: orders, error: ordersError },
        { data: managedUsers, error: managedUsersError },
        { data: admins, error: adminsError },
    ] = await Promise.all(dataPromises);

    if (ordersError) throw ordersError;
    if (managedUsersError) throw managedUsersError;
    if (adminsError) throw adminsError;

    // 3. Calculate profit and manager report
    const statsByManager: Record<string, ManagerStats> = {};
    const allUsersMap: Record<string, string> = {};
    
    (admins as AdminRow[] || []).forEach(admin => { allUsersMap[admin.email] = admin.email });
    (managedUsers as ManagedUserDbRow[] || []).forEach(manager => { allUsersMap[manager.email] = manager.name });

    (orders as any[] || []).forEach(order => {
      const managerEmail = order.managed_by_user_email || 'unassigned';
      if (!statsByManager[managerEmail]) {
        statsByManager[managerEmail] = {
          name: allUsersMap[managerEmail] || managerEmail,
          email: managerEmail,
          totalOrders: 0,
          totalSales: 0,
          totalProfit: 0,
        };
      }
      statsByManager[managerEmail].totalOrders += 1;
      statsByManager[managerEmail].totalSales += order.total_amount;

      const orderProfit = (order.items || []).reduce((profit: number, item: any) => {
        const retailPriceUAH = item.price * (1 - (item.discount || 0) / 100);
        const costUAH = (item.salon_price_usd || 0) * (item.exchange_rate || 0);
        return profit + ((retailPriceUAH - costUAH) * item.quantity);
      }, 0);
      statsByManager[managerEmail].totalProfit += orderProfit;
    });

    const managerReport = Object.values(statsByManager).sort((a, b) => b.totalProfit - a.totalProfit);
    const totalProfit = managerReport.reduce((sum, manager) => sum + manager.totalProfit, 0);

    const stats = {
      totalProfit,
      totalOrders: totalOrdersCount,
      totalCustomers: totalCustomersCount,
      totalManagers: totalManagersCount,
      managerReport,
    };

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(stats),
    };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
        return { statusCode: error.statusCode, headers: commonHeaders, body: JSON.stringify({ message: error.message }) };
    }
    console.error('Error in dashboardStats function:', error);
    return {
        statusCode: 500,
        headers: commonHeaders,
        body: JSON.stringify({ message: 'An internal server error occurred.', details: error.message }),
    };
  }
};

export { handler };
