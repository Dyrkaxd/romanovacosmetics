import React, { useState, useEffect, useCallback, useMemo, FC, SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { ManagerDashboardData, Order } from '../types';
import { OrdersIcon, CurrencyDollarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '../components/Icons'; 
import { authenticatedFetch } from '../utils/api';
import { useAuth } from '../AuthContext';

const StatCard: FC<{ title: string; value: string; change: number; icon: FC<SVGProps<SVGSVGElement>>; isLoading: boolean; }> = ({ title, value, change, icon: Icon, isLoading }) => {
    const isPositive = change >= 0;
    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md hover:border-rose-200 dark:hover:border-rose-500/50">
            <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
                <Icon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            </div>
            {isLoading ? (
                <div className="mt-2 space-y-2">
                    <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse"></div>
                </div>
            ) : (
                <div className="mt-2">
                    <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                    <div className="flex items-center text-xs font-semibold mt-1">
                        <span className={`flex items-center ${isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                            {isPositive ? <ArrowTrendingUpIcon className="w-4 h-4 mr-1"/> : <ArrowTrendingDownIcon className="w-4 h-4 mr-1"/>}
                            {change.toFixed(1)}%
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1">vs минулий період</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const RecentOrdersList: FC<{ orders: ManagerDashboardData['recentOrders']; isLoading: boolean }> = ({ orders, isLoading }) => {
    const navigate = useNavigate();
    const orderStatusTranslations: Record<Order['status'], string> = { Ordered: 'Замовлено', Shipped: 'Відправлено', Received: 'Отримано', Calculation: 'Прорахунок', AwaitingApproval: 'На погодженні', PaidByClient: 'Сплачено клієнтом', WrittenOff: 'Списано', ReadyForPickup: 'Готово для видачі'};
    
    const handleOrderClick = (orderId: string) => {
        navigate('/orders', { state: { openOrderId: orderId } });
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Мої останні замовлення</h3>
            <div className="space-y-1">
                {isLoading ? (
                     [...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>)
                ) : orders.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">У вас ще немає замовлень за цей період.</p>
                ) : (
                    orders.map(order => (
                        <div 
                            key={order.id} 
                            onClick={() => handleOrderClick(order.id)}
                            className="flex justify-between items-center text-sm p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && handleOrderClick(order.id)}
                        >
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{order.customerName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(order.date).toLocaleDateString('uk-UA')}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-800 dark:text-slate-100">₴{order.totalAmount.toFixed(2)}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{orderStatusTranslations[order.status]}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const TopProductsList: FC<{ products: ManagerDashboardData['topProducts']; isLoading: boolean }> = ({ products, isLoading }) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Мої топ товари</h3>
             <div className="space-y-4">
                {isLoading ? (
                     [...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>)
                ) : products.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Немає даних про товари за цей період.</p>
                ) : (
                    products.map(product => (
                        <div key={product.productName} className="text-sm">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">{product.productName}</p>
                                <p className="font-bold text-slate-800 dark:text-slate-100 flex-shrink-0">₴{product.totalRevenue.toFixed(0)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


const ManagerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const fetchManagerData = useCallback(async (currentPeriod: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/managerDashboard?period=${currentPeriod}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Помилка: ${response.statusText}` }));
        throw new Error(errorData.message);
      }
      const dashboardData: ManagerDashboardData = await response.json();
      setData(dashboardData);
    } catch (err: any) {
      console.error("Failed to fetch manager dashboard data:", err);
      setError(err.message || 'Не вдалося завантажити статистику.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagerData(period);
  }, [period, fetchManagerData]);

  const kpis = useMemo(() => {
      const formatCurrency = (value: number) => `₴${(value || 0).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      return [
        { title: 'Мої продажі', value: formatCurrency(data?.kpis.totalSales.value ?? 0), change: data?.kpis.totalSales.change ?? 0, icon: CurrencyDollarIcon },
        { title: 'Мої замовлення', value: (data?.kpis.totalOrders.value ?? 0).toString(), change: data?.kpis.totalOrders.change ?? 0, icon: OrdersIcon },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Вітаємо, {user?.name || 'Менеджер'}!</h2>
          <p className="text-slate-500 dark:text-slate-400">Ось огляд вашої діяльності.</p>
        </div>
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
          {[7, 30, 90].map(p => (
            <button 
              key={p} 
              onClick={() => setPeriod(p as 7 | 30 | 90)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${period === p ? 'bg-rose-50 dark:bg-slate-800 text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {p} днів
            </button>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* KPIs */}
          {kpis.map(kpi => <StatCard key={kpi.title} {...kpi} isLoading={isLoading} />)}

          {/* Recent Orders */}
          <div className="md:col-span-2 lg:col-span-1">
            <RecentOrdersList orders={data?.recentOrders || []} isLoading={isLoading}/>
          </div>
          
          {/* Top Products */}
          <div className="md:col-span-2 lg:col-span-1">
             <TopProductsList products={data?.topProducts || []} isLoading={isLoading}/>
          </div>
      </div>
    </div>
  );
};

export default ManagerDashboardPage;