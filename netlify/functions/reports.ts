import { Handler } from '@netlify/functions';
import { supabase } from '../../services/supabaseClient';
import { requireAuth } from '../utils/auth';
import type { SalesDataPoint, TopProduct, TopCustomer, RevenueByGroup, ReportData, Expense } from '../../types';
import type { Database } from '../../types/supabase';

const commonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const productGroupsMap: Record<string, string> = {
  'BDR': 'products_bdr', 'LA': 'products_la', 'АГ': 'products_ag', 'АБ': 'products_ab_cyr',
  'АР': 'products_ar_cyr', 'без сокращений': 'products_bez_sokr', 'АФ': 'products_af',
  'ДС': 'products_ds', 'м8': 'products_m8', 'JDA': 'products_jda', 'Faith': 'products_faith',
  'AB': 'products_ab_lat', 'ГФ': 'products_gf', 'ЕС': 'products_es', 'ГП': 'products_gp',
  'СД': 'products_sd', 'ATA': 'products_ata', 'W': 'products_w',
  'Гуаша': 'products_guasha',
};

type OrderWithItemsAndCustomer = (Database['public']['Tables']['orders']['Row'] & {
    items: Database['public']['Tables']['order_items']['Row'][];
    customers: { name: string } | null;
});

// Helper function to calculate profit for a single order
const calculateOrderProfit = (order: OrderWithItemsAndCustomer): number => {
    return (order.items || []).reduce((profit, item) => {
        // Use salon_price_usd and exchange_rate stored with the item for historical accuracy
        const retailPriceUAH = item.price * (1 - (item.discount || 0) / 100);
        const costUAH = (item.salon_price_usd || 0) * (item.exchange_rate || 0);
        if (costUAH > 0) {
            return profit + ((retailPriceUAH - costUAH) * item.quantity);
        }
        return profit;
    }, 0);
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
    
    const { startDate, endDate } = event.queryStringParameters || {};
    if (!startDate || !endDate) {
      return { statusCode: 400, headers: commonHeaders, body: JSON.stringify({ message: 'Start and end dates are required.' }) };
    }
    
    const startDateTime = `${startDate}T00:00:00.000Z`;
    const endDateTime = `${endDate}T23:59:59.999Z`;

    const [
        { data: fetchedOrders, error: fetchError },
        { data: expensesDb, error: expensesError },
        productGroupLookups
    ] = await Promise.all([
        supabase
            .from('orders')
            .select('*, items:order_items(*), customers(name)')
            .gte('date', startDateTime)
            .lte('date', endDateTime),
        supabase
            .from('expenses')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false }),
        Promise.all(Object.entries(productGroupsMap).map(async ([group, tableName]) => {
            const { data, error } = await supabase.from(tableName).select('id');
            if (error) {
                console.warn(`Could not fetch products from ${tableName} for report generation: ${error.message}`);
                return [];
            }
            return (data || []).map(p => ({ id: p.id as string, group }));
        }))
    ]);
      
    if (fetchError) throw fetchError;
    if (expensesError) throw expensesError;

    const totalExpenses = (expensesDb || []).reduce((sum, exp) => sum + exp.amount, 0);

    const expenses: Expense[] = (expensesDb || []).map(exp => ({
      id: exp.id,
      name: exp.name,
      amount: exp.amount,
      date: exp.date,
      notes: exp.notes || undefined,
      created_at: exp.created_at,
      created_by_user_email: exp.created_by_user_email || undefined,
    }));

    // --- Calculations are now based on 'Received' orders ---
    const receivedOrders = (fetchedOrders || []).filter(o => o.status === 'Received');

    const productToGroupMap = new Map<string, string>();
    (productGroupLookups || []).flat().forEach(p => productToGroupMap.set(p.id, p.group));
    
    let totalRevenue = 0, grossProfit = 0;
    const dailyStatsMap = new Map<string, { sales: number, profit: number }>();
    const productsMap = new Map<string, TopProduct>();
    const customersMap = new Map<string, TopCustomer>();
    const revenueByGroupMap = new Map<string, number>();

    // The sales/profit chart will show gross profit from ALL orders to show overall business activity
    (fetchedOrders || []).forEach(order => {
        const orderProfit = calculateOrderProfit(order);
        const orderDate = new Date(order.date).toISOString().split('T')[0];
        const dailyStats = dailyStatsMap.get(orderDate) || { sales: 0, profit: 0 };
        dailyStats.sales += order.total_amount;
        dailyStats.profit += orderProfit;
        dailyStatsMap.set(orderDate, dailyStats);
    });

    // All other KPIs and lists are based on received orders
    receivedOrders.forEach(order => {
      const orderProfit = calculateOrderProfit(order);
      totalRevenue += order.total_amount;
      grossProfit += orderProfit;
      
      const customer = customersMap.get(order.customer_id);
      if (customer) {
        customer.totalSpent += order.total_amount;
        customer.orderCount += 1;
      } else {
        customersMap.set(order.customer_id, { customerId: order.customer_id, customerName: order.customers?.name || 'Unknown', totalSpent: order.total_amount, orderCount: 1 });
      }

      order.items.forEach(item => {
        const itemRevenue = item.quantity * item.price * (1 - (item.discount || 0) / 100);
        const productGroup = productToGroupMap.get(item.product_id || '') || 'Інші';
        
        if (item.product_id) {
            const product = productsMap.get(item.product_id);
            if (product) {
                product.totalQuantity += item.quantity;
                product.totalRevenue += itemRevenue;
            } else {
                productsMap.set(item.product_id, { productId: item.product_id, productName: item.product_name, totalQuantity: item.quantity, totalRevenue: itemRevenue, group: productGroup });
            }
            revenueByGroupMap.set(productGroup, (revenueByGroupMap.get(productGroup) || 0) + itemRevenue);
        }
      });
    });
    
    const netProfit = grossProfit - totalExpenses;

    const getDateRange = (start: string, end: string): string[] => {
      const dates = [];
      let currentDate = new Date(`${start}T00:00:00Z`);
      const endDateUTC = new Date(`${end}T00:00:00Z`);
      while (currentDate <= endDateUTC) {
          dates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
      return dates;
    };

    const dateRange = getDateRange(startDate, endDate);
    const salesByDay: SalesDataPoint[] = dateRange.map(date => ({ 
        date, 
        totalSales: dailyStatsMap.get(date)?.sales || 0,
        totalProfit: dailyStatsMap.get(date)?.profit || 0 
    }));
    const topProducts: TopProduct[] = Array.from(productsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    const topCustomers: TopCustomer[] = Array.from(customersMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
    const revenueByGroup: RevenueByGroup[] = Array.from(revenueByGroupMap.entries()).map(([group, revenue]) => ({ group, revenue })).sort((a, b) => b.revenue - a.revenue);

    const reportData: ReportData = { 
        totalRevenue, 
        totalProfit: netProfit, 
        grossProfit, 
        totalExpenses, 
        totalOrders: receivedOrders.length, 
        salesByDay, 
        topProducts, 
        topCustomers, 
        revenueByGroup,
        expenses,
    };
    
    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify(reportData) };

  } catch (error: any) {
    console.error('Error in reports.ts:', error);
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ message: error.message || 'Server error while generating report.' }) };
  }
};

export { handler };