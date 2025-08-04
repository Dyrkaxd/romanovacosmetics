
import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';
import type { ManagerDashboardData, KPI } from '../../types';
import type { Database } from '../../types/supabase';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

type OrderWithItems = (Database['public']['Tables']['orders']['Row'] & {
    items: Database['public']['Tables']['order_items']['Row'][];
});

const getKPIs = (orders: OrderWithItems[]): { sales: number, orders: number } => {
    const sales = orders.reduce((sum, order) => sum + order.total_amount, 0);
    return {
        sales,
        orders: orders.length,
    };
};

const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: commonHeaders, body: '' };
  }

  try {
    const user = await requireAuth(event);
    
    const period = parseInt(event.queryStringParameters?.period || '30', 10);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);
    
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - period);

    const fetchOrdersForPeriod = (start: Date, end: Date) =>
        supabase.from('orders')
            .select('*, items:order_items(*)')
            .eq('managed_by_user_email', user.email)
            .gte('date', start.toISOString())
            .lte('date', end.toISOString());

    const [
      { data: currentOrders, error: currentOrdersError },
      { data: prevOrders, error: prevOrdersError }
    ] = await Promise.all([
      fetchOrdersForPeriod(startDate, endDate),
      fetchOrdersForPeriod(prevStartDate, prevEndDate)
    ]);

    if (currentOrdersError) throw currentOrdersError;
    if (prevOrdersError) throw prevOrdersError;

    const currentKPIs = getKPIs(currentOrders || []);
    const previousKPIs = getKPIs(prevOrders || []);

    const kpis: ManagerDashboardData['kpis'] = {
      totalSales: { value: currentKPIs.sales, change: calculateChange(currentKPIs.sales, previousKPIs.sales) },
      totalOrders: { value: currentKPIs.orders, change: calculateChange(currentKPIs.orders, previousKPIs.orders) }
    };
    
    // Recent Orders
    const { data: recentOrdersData, error: recentOrdersError } = await supabase
        .from('orders')
        .select('id, customerName:customers(name), totalAmount:total_amount, status, date')
        .eq('managed_by_user_email', user.email)
        .order('date', { ascending: false })
        .limit(5);

    if (recentOrdersError) throw recentOrdersError;

    const recentOrders = (recentOrdersData as any[] || []).map(o => ({
        ...o,
        customerName: o.customerName?.name ?? 'Unknown'
    }));
    
    // Top Products
    const productsMap = new Map<string, { name: string, revenue: number }>();
    (currentOrders || []).forEach(order => {
        order.items.forEach(item => {
            const itemRevenue = item.price * item.quantity * (1 - (item.discount || 0) / 100);
            const product = productsMap.get(item.product_id!);
            if (product) {
                product.revenue += itemRevenue;
            } else {
                productsMap.set(item.product_id!, { name: item.product_name, revenue: itemRevenue });
            }
        });
    });
    const topProducts = Array.from(productsMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(p => ({ productName: p.name, totalRevenue: p.revenue }));

    const response: ManagerDashboardData = { kpis, recentOrders, topProducts };

    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(response) };

  } catch (error: any) {
    if (error.statusCode) { // AuthError
      return {
        statusCode: error.statusCode,
        headers: commonHeaders,
        body: JSON.stringify({ message: error.message }),
      };
    }
    console.error('Error in managerDashboard function:', error);
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: error.message || 'Server error while fetching manager dashboard data.' }) };
  }
};

export { handler };