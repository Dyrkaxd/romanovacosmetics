import React, { useState, useEffect, useCallback } from 'react';
import { DashboardStat, Order as AppOrder, Product as AppProduct, Customer as AppCustomer, ManagedUser } from '../types';
import { OrdersIcon, ProductsIcon, UsersIcon, DashboardIcon, LightBulbIcon } from '../components/Icons'; 
import { authenticatedFetch } from '../utils/api';
import { useAuth } from '../AuthContext';

const API_BASE_URL = '/api';

const DashboardCard: React.FC<DashboardStat & { isLoading?: boolean }> = ({ title, value, icon: Icon, color, percentageChange, isPositive, isLoading }) => {
  const percentageColor = isPositive ? 'text-green-600' : 'text-red-600';
  
  const colorVariants: { [key: string]: { text: string; bg: string; } } = {
    'rose': { text: 'text-rose-600', bg: 'bg-rose-50' },
    'green': { text: 'text-green-600', bg: 'bg-green-50' },
    'amber': { text: 'text-amber-600', bg: 'bg-amber-50' },
    'sky': { text: 'text-sky-600', bg: 'bg-sky-50' },
    'indigo': { text: 'text-indigo-600', bg: 'bg-indigo-50' },
  };

  const selectedColor = colorVariants[color] || { text: 'text-slate-600', bg: 'bg-slate-100' };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
      <div className={`p-3 rounded-full ${selectedColor.bg}`}>
        <Icon className={`w-7 h-7 ${selectedColor.text}`} />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        {isLoading ? (
            <div className="h-8 w-24 bg-slate-200 rounded-md mt-1 animate-pulse"></div>
        ) : (
            <p className="text-3xl font-bold text-slate-800">{value}</p>
        )}
        {percentageChange && !isLoading && (
           <p className={`text-xs font-semibold ${percentageColor}`}>
            {isPositive ? '↑' : '↓'} {percentageChange}
           </p>
        )}
      </div>
    </div>
  );
};

const SalesChartPlaceholder = () => (
  <div className="w-full h-full opacity-75">
    <svg width="100%" height="100%" viewBox="0 0 800 400" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f472b6" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#f472b6" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* Grid lines */}
      <g stroke="#e2e8f0" strokeWidth="1">
        {[...Array(5)].map((_, i) => (
          <line key={i} x1="0" y1={i * 100} x2="800" y2={i * 100} />
        ))}
        {[...Array(8)].map((_, i) => (
          <line key={i} x1={i * 100} y1="0" x2={i * 100} y2="400" />
        ))}
      </g>
      {/* Chart Path */}
      <path d="M 0 300 L 100 250 L 200 280 L 300 220 L 400 240 L 500 180 L 600 200 L 700 150 L 800 170" fill="url(#chartGradient)" stroke="#f472b6" strokeWidth="3" />
      {/* Chart Points */}
      <g fill="#f472b6">
        <circle cx="100" cy="250" r="5" />
        <circle cx="200" cy="280" r="5" />
        <circle cx="300" cy="220" r="5" />
        <circle cx="400" cy="240" r="5" />
        <circle cx="500" cy="180" r="5" />
        <circle cx="600" cy="200" r="5" />
        <circle cx="700" cy="150" r="5" />
        <circle cx="800" cy="170" r="5" />
      </g>
    </svg>
  </div>
);


const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [totalSales, setTotalSales] = useState<number>(0);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [productCount, setProductCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingManagers, setIsLoadingManagers] = useState(true);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const [ordersRes, productsRes, customersRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/orders`),
        authenticatedFetch(`${API_BASE_URL}/products`),
        authenticatedFetch(`${API_BASE_URL}/customers`),
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

  const fetchManagedUsers = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setIsLoadingManagers(true);
    setStatsError(null);
    try {
        const response = await authenticatedFetch('/api/managedUsers');
        if (!response.ok) throw new Error('Failed to fetch managers');
        const data = await response.json();
        setManagedUsers(data);
    } catch (err: any) {
        console.error("Failed to fetch managed users:", err);
        setStatsError(err.message || "Could not load manager data.");
    } finally {
        setIsLoadingManagers(false);
    }
  }, [user?.role]);

  const fetchAiSummary = useCallback(async () => {
    setIsLoadingAiSummary(true);
    setAiSummaryError(null);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/dashboardSummary`);
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
    fetchManagedUsers();
  }, [fetchDashboardData, fetchAiSummary, fetchManagedUsers]);

  const stats: DashboardStat[] = [
    { title: 'Загальні продажі', value: `₴${totalSales.toFixed(2)}`, icon: DashboardIcon, color: 'rose', isLoading: isLoadingStats },
    { title: 'Всього замовлень', value: orderCount.toString(), icon: OrdersIcon, color: 'green', isLoading: isLoadingStats },
    { title: 'Кількість менеджерів', value: managedUsers.length.toString(), icon: UsersIcon, color: 'indigo', isLoading: isLoadingManagers },
    { title: 'Активні клієнти', value: customerCount.toString(), icon: UsersIcon, color: 'sky', isLoading: isLoadingStats },
  ];

  return (
    <div className="space-y-6">
      {statsError && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{statsError}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <DashboardCard key={stat.title} {...stat} isLoading={stat.isLoading} />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Огляд продажів</h3>
          <div className="h-80">
            <SalesChartPlaceholder />
          </div>
        </div>

        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <LightBulbIcon className="w-6 h-6 mr-2 text-amber-500" />
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
                    <p className="text-sm text-slate-600 leading-relaxed">{aiSummary}</p>

                )}
            </div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Огляд менеджерів</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Ім'я</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden md:table-cell">Дата додавання</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden sm:table-cell">Нотатки</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {isLoadingManagers ? (
                            <tr><td colSpan={4} className="text-center py-10 text-slate-500">Завантаження менеджерів...</td></tr>
                        ) : managedUsers.length > 0 ? (
                            managedUsers.map(manager => (
                                <tr key={manager.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{manager.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{manager.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden md:table-cell">{new Date(manager.dateAdded).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden sm:table-cell truncate max-w-xs">{manager.notes || '-'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4} className="text-center py-10 text-slate-500">Менеджерів не знайдено.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;