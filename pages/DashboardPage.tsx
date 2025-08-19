import React, { useState, useEffect, useCallback, useMemo, FC, SVGProps } from 'react';
import { DashboardData, Order } from '../types';
import { OrdersIcon, UsersIcon, CurrencyDollarIcon, LightBulbIcon, ArrowPathIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '../components/Icons'; 
import { authenticatedFetch } from '../utils/api';
import { useAuth } from '../AuthContext';
import StatCard from '../components/StatCard';


const SalesProfitChart: FC<{ data: DashboardData['chartData']; isLoading: boolean }> = ({ data, isLoading }) => {
    const chartRef = React.useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

    const chartMetrics = useMemo(() => {
        const maxSales = Math.max(...data.map(d => d.sales), 0);
        const maxProfit = Math.max(...data.map(d => d.profit), 0);
        const overallMax = Math.max(maxSales, maxProfit);
        
        if (data.length < 2) return { salesPath: '', profitPath: '', points: [], overallMax };
        
        const points = data.map((point, index) => ({
            x: (index / (data.length - 1)) * 100,
            salesY: 100 - (overallMax > 0 ? (point.sales / overallMax) * 95 : 0),
            profitY: 100 - (overallMax > 0 ? (point.profit / overallMax) * 95 : 0),
            date: new Date(point.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
            sales: point.sales,
            profit: point.profit,
        }));

        const salesPath = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x},${p.salesY}`).join(' ');
        const profitPath = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x},${p.profitY}`).join(' ');

        return { salesPath, profitPath, points, overallMax };
    }, [data]);

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!chartRef.current || chartMetrics.points.length === 0) return;
        
        const svgRect = chartRef.current.getBoundingClientRect();
        const x = event.clientX - svgRect.left;
        const relativeX = (x / svgRect.width) * 100;
        
        const closestPoint = chartMetrics.points.reduce((prev, curr) => 
            Math.abs(curr.x - relativeX) < Math.abs(prev.x - relativeX) ? curr : prev
        );
        
        const tooltipX = (closestPoint.x / 100) * svgRect.width;
        const tooltipY = (Math.min(closestPoint.salesY, closestPoint.profitY) / 100) * svgRect.height;

        setTooltip({
            x: tooltipX,
            y: tooltipY,
            content: `${closestPoint.date}: ₴${closestPoint.sales.toFixed(0)} (Дохід) / ₴${closestPoint.profit.toFixed(0)} (Прибуток)`
        });
    };
    
    if (isLoading) return <div className="h-80 w-full bg-slate-200 dark:bg-slate-900 rounded-lg animate-pulse"></div>;
    
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Огляд продажів і прибутку</h3>
            <div className="relative h-80" onMouseLeave={() => setTooltip(null)}>
                <svg ref={chartRef} viewBox="0 0 100 105" className="w-full h-full" preserveAspectRatio="none" onMouseMove={handleMouseMove}>
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(y => (
                       <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="0.2"/>
                    ))}
                    <path d={chartMetrics.salesPath} fill="none" stroke="#f43f5e" strokeWidth="0.7" strokeLinejoin="round" strokeLinecap="round" />
                    <path d={chartMetrics.profitPath} fill="none" stroke="#16a34a" strokeWidth="0.7" strokeLinejoin="round" strokeLinecap="round" />
                    {tooltip && <line x1={tooltip.x / chartRef.current!.getBoundingClientRect().width * 100} y1="0" x2={tooltip.x / chartRef.current!.getBoundingClientRect().width * 100} y2="100" stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="0.3" strokeDasharray="2"/>}
                </svg>
                {tooltip && (
                    <div className="absolute p-2 bg-slate-800 text-white text-xs rounded-md shadow-lg pointer-events-none" style={{ left: tooltip.x, top: tooltip.y, transform: `translate(-50%, -120%)` }}>
                        {tooltip.content}
                    </div>
                )}
            </div>
             <div className="flex justify-center space-x-4 mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                <span className="flex items-center"><span className="w-3 h-3 bg-rose-500 rounded-full mr-2"></span>Дохід</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>Прибуток</span>
            </div>
        </div>
    );
};

const RecentOrders: FC<{ orders: DashboardData['recentOrders']; isLoading: boolean }> = ({ orders, isLoading }) => {
    const orderStatusTranslations: Record<Order['status'], string> = { Ordered: 'Замовлено', Shipped: 'Відправлено', Received: 'Отримано', Calculation: 'Прорахунок', AwaitingApproval: 'На погодженні', PaidByClient: 'Сплачено клієнтом', WrittenOff: 'Списано', ReadyForPickup: 'Готово для видачі'};
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Останні замовлення</h3>
            <div className="space-y-4">
                {isLoading ? (
                     [...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>)
                ) : orders.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Замовлень за цей період немає.</p>
                ) : (
                    orders.map(order => (
                        <div key={order.id} className="flex justify-between items-center text-sm">
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

const TopProducts: FC<{ products: DashboardData['topProducts']; isLoading: boolean }> = ({ products, isLoading }) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Топ товари</h3>
             <div className="space-y-4">
                {isLoading ? (
                     [...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>)
                ) : products.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Товарів за цей період немає.</p>
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

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const fetchDashboardData = useCallback(async (currentPeriod: number) => {
    if (user?.role !== 'admin') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/dashboard?period=${currentPeriod}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `An error occurred: ${response.statusText}` }));
        throw new Error(errorData.message);
      }
      const dashboardData: DashboardData = await response.json();
      setData(dashboardData);
    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err.message || 'Could not load dashboard statistics.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchDashboardData(period);
  }, [period, fetchDashboardData]);

  const kpis = useMemo(() => {
      const formatCurrency = (value: number) => `₴${(value || 0).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      return [
        { title: 'Дохід', value: formatCurrency(data?.kpis.revenue.value ?? 0), change: data?.kpis.revenue.change ?? 0, icon: CurrencyDollarIcon },
        { title: 'Прибуток', value: formatCurrency(data?.kpis.profit.value ?? 0), change: data?.kpis.profit.change ?? 0, icon: CurrencyDollarIcon },
        { title: 'Замовлення', value: (data?.kpis.orders.value ?? 0).toString(), change: data?.kpis.orders.change ?? 0, icon: OrdersIcon },
        { title: 'Нові клієнти', value: (data?.kpis.customers.value ?? 0).toString(), change: data?.kpis.customers.change ?? 0, icon: UsersIcon },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Вітаємо, {user?.name || 'User'}!</h2>
          <p className="text-slate-500 dark:text-slate-400">Ось огляд вашого бізнесу.</p>
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
      
      {user?.role === 'admin' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* KPIs */}
          {kpis.map(kpi => <StatCard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} change={kpi.change} isLoading={isLoading} />)}

          {/* Main Chart */}
          <div className="lg:col-span-4">
            <SalesProfitChart data={data?.chartData || []} isLoading={isLoading}/>
          </div>
          
          {/* Recent Orders */}
          <div className="lg:col-span-2">
             <RecentOrders orders={data?.recentOrders || []} isLoading={isLoading}/>
          </div>
          
          {/* Top Products */}
          <div className="lg:col-span-2">
             <TopProducts products={data?.topProducts || []} isLoading={isLoading}/>
          </div>

        </div>
      ) : (
        <p className="text-slate-600 dark:text-slate-400">Панель керування доступна лише для адміністраторів.</p>
      )}
    </div>
  );
};

export default DashboardPage;