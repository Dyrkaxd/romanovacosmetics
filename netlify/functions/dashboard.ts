
import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';
import type { DashboardData, KPI } from '../../types';
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

const calculateProfit = (order: OrderWithItems): number => {
    return (order.items || []).reduce((profit, item) => {
        const retailPriceUAH = item.price * (1 - (item.discount || 0) / 100);
        const costUAH = (item.salon_price_usd || 0) * (item.exchange_rate || 0);
        return profit + ((retailPriceUAH - costUAH) * item.quantity);
    }, 0);
};

const getKPIs = (orders: OrderWithItems[], customers: { created_at: string }[]): { revenue: number, profit: number, orders: number, customers: number } => {
    const revenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const profit = orders.reduce((sum, order) => sum + calculateProfit(order), 0);
    return {
        revenue,
        profit,
        orders: orders.length,
        customers: customers.length,
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
    if (user.role !== 'admin') {
      return { statusCode: 403, headers: commonHeaders, body: JSON.stringify({ message: 'Forbidden: Admin access required.' }) };
    }
    
    const period = parseInt(event.queryStringParameters?.period || '30', 10);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);
    
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - period);

    const [
      { data: currentOrders, error: currentOrdersError },
      { data: prevOrders, error: prevOrdersError },
      { data: currentCustomers, error: currentCustomersError },
      { data: prevCustomers, error: prevCustomersError }
    ] = await Promise.all([
      supabase.from('orders').select('*, items:order_items(*)').gte('date', startDate.toISOString()).lte('date', endDate.toISOString()),
      supabase.from('orders').select('*, items:order_items(*)').gte('date', prevStartDate.toISOString()).lte('date', prevEndDate.toISOString()),
      supabase.from('customers').select('created_at').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
      supabase.from('customers').select('created_at').gte('created_at', prevStartDate.toISOString()).lte('created_at', prevEndDate.toISOString())
    ]);

    if (currentOrdersError) throw currentOrdersError;
    if (prevOrdersError) throw prevOrdersError;
    if (currentCustomersError) throw currentCustomersError;
    if (prevCustomersError) throw prevCustomersError;

    const currentKPIs = getKPIs(currentOrders || [], currentCustomers || []);
    const previousKPIs = getKPIs(prevOrders || [], prevCustomers || []);

    const kpis: DashboardData['kpis'] = {
      revenue: { value: currentKPIs.revenue, change: calculateChange(currentKPIs.revenue, previousKPIs.revenue) },
      profit: { value: currentKPIs.profit, change: calculateChange(currentKPIs.profit, previousKPIs.profit) },
      orders: { value: currentKPIs.orders, change: calculateChange(currentKPIs.orders, previousKPIs.orders) },
      customers: { value: currentKPIs.customers, change: calculateChange(currentKPIs.customers, previousKPIs.customers) }
    };

    // Chart Data
    const chartDataMap = new Map<string, { sales: number, profit: number }>();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        chartDataMap.set(d.toISOString().split('T')[0], { sales: 0, profit: 0 });
    }
    
    (currentOrders || []).forEach(order => {
        const date = new Date(order.date).toISOString().split('T')[0];
        if(chartDataMap.has(date)) {
            const day = chartDataMap.get(date)!;
            day.sales += order.total_amount;
            day.profit += calculateProfit(order);
        }
    });
    const chartData = Array.from(chartDataMap.entries()).map(([date, values]) => ({ date, ...values }));

    // Recent Orders
    const { data: recentOrdersData, error: recentOrdersError } = await supabase
        .from('orders')
        .select('id, customerName:customers(name), totalAmount:total_amount, status, date')
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

    const response: DashboardData = { kpis, chartData, recentOrders, topProducts };

    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(response) };

  } catch (error: any) {
    console.error('Error in dashboard function:', error);
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: error.message || 'Server error while fetching dashboard data.' }) };
  }
};

export { handler };
