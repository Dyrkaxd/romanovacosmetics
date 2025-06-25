
import React, { useState, useEffect, useCallback } from 'react';
import { DashboardStat, Order as AppOrder, Product as AppProduct, Customer as AppCustomer } from '../types';
import { OrdersIcon, ProductsIcon, UsersIcon, DashboardIcon, LightBulbIcon } from '../components/Icons'; 

const API_BASE_URL = '/api';

const DashboardCard: React.FC<DashboardStat & { isLoading?: boolean }> = ({ title, value, icon: Icon, color, percentageChange, isPositive, isLoading }) => {
  const percentageColor = isPositive ? 'text-green-500' : 'text-red-500';
  return (
    <div className={`bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4 border-l-4 ${color}`}>
      <div className={`p-3 rounded-full bg-opacity-20 ${color.replace('border', 'bg').replace('-500', '-100')}`}>
        <Icon className={`w-8 h-8 ${color.replace('border', 'text')}`} />
      </div>
      <div>
        <p className="text-sm text-slate-600 font-medium">{title}</p>
        {isLoading ? (
            <p className="text-2xl font-semibold text-slate-800 animate-pulse">...</p>
        ) : (
            <p className="text-2xl font-semibold text-slate-800">{value}</p>
        )}
        {percentageChange && !isLoading && (
           <p className={`text-xs ${percentageColor}`}>
            {isPositive ? '↑' : '↓'} {percentageChange} {/* проти минулого місяця - comparison not implemented yet */}
           </p>
        )}
      </div>
    </div>
  );
};


const DashboardPage: React.FC = () => {
  const [totalSales, setTotalSales] = useState<number>(0);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [productCount, setProductCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [aiSummary, setAiSummary] = useState<string>('');
  
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const [ordersRes, productsRes, customersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/orders`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/customers`),
      ]);

      if (!ordersRes.ok) throw new Error(`Failed to fetch orders: ${ordersRes.statusText}`);
      const ordersData: AppOrder[] = await ordersRes.json();
      setOrderCount(ordersData.length);
      const sales = ordersData.reduce((sum, order) => sum + order.totalAmount, 0);
      setTotalSales(sales);

      if (!productsRes.ok) throw new Error(`Failed to fetch products: ${productsRes.statusText}`);
      const productsData: AppProduct[] = await productsRes.json();
      setProductCount(productsData.length);

      if (!customersRes.ok) throw new Error(`Failed to fetch customers: ${customersRes.statusText}`);
      const customersData: AppCustomer[] = await customersRes.json();
      setCustomerCount(customersData.length);

    } catch (err: any) {
      console.error("Failed to fetch dashboard stats:", err);
      setStatsError(err.message || 'Could not load dashboard statistics.');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  const fetchAiSummary = useCallback(async () => {
    setIsLoadingAiSummary(true);
    setAiSummaryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/dashboardSummary`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch AI summary.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: { summary: string } = await response.json();
      setAiSummary(data.summary);
    } catch (err: any) {
      console.error("Failed to fetch AI summary:", err);
      setAiSummaryError(err.message || 'Could not load AI summary.');
      setAiSummary('Не вдалося завантажити AI-підсумок.');
    } finally {
      setIsLoadingAiSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchAiSummary();
  }, [fetchDashboardData, fetchAiSummary]);

  const stats: DashboardStat[] = [
    { title: 'Загальні продажі', value: `$${totalSales.toFixed(2)}`, icon: DashboardIcon, color: 'border-indigo-500', isLoading: isLoadingStats },
    { title: 'Всього замовлень', value: orderCount.toString(), icon: OrdersIcon, color: 'border-green-500', isLoading: isLoadingStats },
    { title: 'Всього товарів', value: productCount.toString(), icon: ProductsIcon, color: 'border-amber-500', isLoading: isLoadingStats },
    { title: 'Активні клієнти', value: customerCount.toString(), icon: UsersIcon, color: 'border-sky-500', isLoading: isLoadingStats },
  ];

  return (
    <div className="space-y-6">
      {statsError && <div role="alert" className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{statsError}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <DashboardCard key={stat.title} {...stat} isLoading={stat.isLoading} />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-slate-700 mb-4">Огляд продажів</h3>
          {/* Placeholder for chart - data for chart could be derived from fetched orders */}
          <img src="https://picsum.photos/seed/saleschart/800/400" alt="Заповнювач діаграми продажів" className="w-full h-auto rounded-md"/>
          <p className="text-sm text-slate-600 mt-2">Заповнювач для діаграми продажів (напр., з Recharts).</p>
        </div>

        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold text-slate-700 mb-4 flex items-center">
                    <LightBulbIcon className="w-6 h-6 mr-2 text-yellow-500" />
                    AI-Powered Insights
                </h3>
                {aiSummaryError && !isLoadingAiSummary && <p className="text-sm text-red-600">{aiSummaryError}</p>}
                {isLoadingAiSummary ? (
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-full"></div>
                        <div className="h-4 bg-slate-200 rounded animate-pulse w-2/3"></div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-600 whitespace-pre-line">{aiSummary}</p>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold text-slate-700 mb-4">Останні дії</h3>
              <ul className="space-y-3">
                {[
                  {user: 'Аліса', action: 'розмістила нове замовлення #ORD001.'},
                  {user: 'Богдан', action: 'оновив товар "Бездротова миша".'},
                  {user: 'Чарлі', action: 'переглянув "Ігрова клавіатура".'},
                  {user: 'Давид', action: 'скасував замовлення #ORD004.'},
                  {user: 'Єва', action: 'зареєструвала новий обліковий запис.'},
                ].map((activity, index) => (
                  <li key={index} className="flex items-start text-sm">
                    <img src={`https://picsum.photos/seed/user${index}/32/32`} alt={activity.user} className="w-8 h-8 rounded-full mr-3"/>
                    <div>
                      <span className="font-medium text-slate-700">{activity.user}</span>
                      <span className="text-slate-600 ml-1">{activity.action}</span>
                      <p className="text-xs text-slate-500">{(index + 1) * 5} хвилин тому</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;