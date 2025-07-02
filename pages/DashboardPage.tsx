import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardStat, Order, ManagedUser, Customer } from '../types';
import { OrdersIcon, UsersIcon, CurrencyDollarIcon } from '../components/Icons'; 
import { authenticatedFetch } from '../utils/api';
import { useAuth } from '../AuthContext';
import { Database } from '../types/supabase';

type AdminRow = Database['public']['Tables']['admins']['Row'];

const API_BASE_URL = '/api';

const DashboardCard: React.FC<DashboardStat & { isLoading?: boolean }> = ({ title, value, icon: Icon, color, isLoading }) => {
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
            <div className="h-8 w-32 bg-slate-200 rounded-md mt-1 animate-pulse"></div>
        ) : (
            <p className="text-3xl font-bold text-slate-800">{value}</p>
        )}
      </div>
    </div>
  );
};


interface ManagerStats {
  name: string;
  email: string;
  totalOrders: number;
  totalSales: number;
  totalProfit: number;
}

const ProfitReportChart: React.FC<{ report: ManagerStats[]; isLoading: boolean }> = ({ report, isLoading }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>(undefined);

  const COLORS = ['#e11d48', '#3b82f6', '#16a34a', '#f97316', '#8b5cf6', '#db2777', '#0891b2', '#ca8a04'];
  
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="h-8 w-1/2 bg-slate-200 rounded-md animate-pulse mb-6"></div>
        <div className="flex items-center justify-center h-72">
          <div className="w-48 h-48 border-8 border-slate-100 border-t-slate-300 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (report.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Розподіл прибутку по менеджерах</h3>
        <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-lg">
          <p className="font-semibold">Дані для звіту відсутні</p>
          <p className="text-sm mt-1">Створіть замовлення, щоб побачити статистику.</p>
        </div>
      </div>
    );
  }

  const totalProfitForChart = report.reduce((sum, manager) => sum + manager.totalProfit, 0);

  const pieData = report.map((manager, index) => ({
    title: manager.name,
    value: manager.totalProfit > 0 ? manager.totalProfit : 0, // Ensure value is not negative for chart
    color: COLORS[index % COLORS.length],
  }));

  let accumulated = 0;
  const segments = pieData.map(segment => {
      const percentage = totalProfitForChart > 0 ? segment.value / totalProfitForChart : 0;
      const startAngle = accumulated * 360;
      accumulated += percentage;
      const endAngle = accumulated * 360;
      return { ...segment, startAngle, endAngle };
  });

  const getCoordinatesForAngle = (angle: number, radius = 0.5) => {
    return [
      Math.cos((angle * Math.PI) / 180) * radius,
      Math.sin((angle * Math.PI) / 180) * radius,
    ];
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Розподіл прибутку по менеджерах</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="relative h-64 md:h-72">
          <svg viewBox="-0.5 -0.5 1 1" style={{ transform: 'rotate(-90deg)' }}>
            {segments.map((segment, index) => {
              const [startX, startY] = getCoordinatesForAngle(segment.startAngle);
              const [endX, endY] = getCoordinatesForAngle(segment.endAngle);
              const largeArcFlag = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
              const pathData = `M ${startX} ${startY} A 0.5 0.5 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;
              
              const isHovered = hoveredIndex === index;

              return (
                  <path
                      key={segment.title}
                      d={pathData}
                      fill={segment.color}
                      onMouseOver={() => setHoveredIndex(index)}
                      onMouseOut={() => setHoveredIndex(undefined)}
                      style={{
                          transition: 'transform 0.2s ease-in-out, opacity 0.2s',
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          opacity: hoveredIndex !== undefined && !isHovered ? 0.6 : 1,
                          cursor: 'pointer',
                          stroke: 'white',
                          strokeWidth: 0.01,
                          strokeLinejoin: 'round',
                      }}
                  />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
              <span className="text-3xl font-bold text-slate-800">
                {hoveredIndex !== undefined 
                  ? `${((pieData[hoveredIndex].value / totalProfitForChart) * 100).toFixed(1)}%`
                  : 'Всього'
                }
              </span>
              {hoveredIndex !== undefined && (
                 <span className="text-sm font-medium text-slate-500">{pieData[hoveredIndex].title}</span>
              )}
          </div>
        </div>
        
        <ul className="space-y-3">
          {report.map((manager, index) => {
            const percentage = totalProfitForChart > 0 ? (manager.totalProfit / totalProfitForChart) * 100 : 0;
            return (
              <li
                key={manager.email}
                className={`p-3 rounded-lg flex items-center justify-between transition-all duration-200 cursor-pointer ${hoveredIndex === index ? 'bg-slate-100 shadow-sm' : 'hover:bg-slate-50'}`}
                onMouseOver={() => setHoveredIndex(index)}
                onMouseOut={() => setHoveredIndex(undefined)}
              >
                <div className="flex items-center truncate">
                  <span
                    className="w-3.5 h-3.5 rounded-full mr-3 flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium text-slate-700 truncate">{manager.name}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="font-bold text-slate-800">₴{manager.totalProfit.toFixed(2)}</p>
                  <p className="text-sm text-slate-500">{percentage.toFixed(1)}%</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};


const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoints = ['/api/orders', '/api/customers'];
      if(user?.role === 'admin') {
          endpoints.push('/api/managedUsers', '/api/admins');
      }
      
      const responses = await Promise.all(
        endpoints.map(ep => authenticatedFetch(ep))
      );

      for(const res of responses) {
          if(!res.ok) {
              const errorData = await res.json().catch(() => ({ message: `An error occurred: ${res.statusText}`}));
              throw new Error(errorData.message);
          }
      }

      const [ordersData, customersData, managedUsersData, adminsData] = await Promise.all(responses.map(res => res.json()));
      
      setOrders(ordersData || []);
      setCustomers(customersData || []);
      if(user?.role === 'admin') {
        setManagedUsers((managedUsersData || []).map((u: any) => ({
             id: u.id, name: u.name, email: u.email,
             notes: u.notes || undefined, dateAdded: u.created_at || new Date().toISOString(),
        })));
        setAdmins(adminsData || []);
      }

    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err.message || 'Could not load dashboard statistics.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const { totalProfit, managerReport } = useMemo(() => {
    if (orders.length === 0) {
      return { totalProfit: 0, managerReport: [] };
    }

    const statsByManager: Record<string, ManagerStats> = {};

    // Create a map of all users (admins and managers) for easy name lookup
    const allUsersMap: Record<string, string> = {};
    admins.forEach(admin => { allUsersMap[admin.email] = user?.email === admin.email ? (user?.name || admin.email) : admin.email });
    managedUsers.forEach(manager => { allUsersMap[manager.email] = manager.name });

    orders.forEach(order => {
      const managerEmail = order.managedByUserEmail || 'unassigned';
      
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
      statsByManager[managerEmail].totalSales += order.totalAmount;

      const orderProfit = order.items.reduce((profit, item) => {
        const retailPriceUAH = item.price * (1 - (item.discount || 0) / 100);
        const costUAH = (item.salonPriceUsd || 0) * (item.exchangeRate || 0);
        return profit + ((retailPriceUAH - costUAH) * item.quantity);
      }, 0);

      statsByManager[managerEmail].totalProfit += orderProfit;
    });

    const report = Object.values(statsByManager).sort((a,b) => b.totalProfit - a.totalProfit);
    const total = report.reduce((sum, manager) => sum + manager.totalProfit, 0);
    
    return { totalProfit: total, managerReport: report };

  }, [orders, managedUsers, admins, user]);


  const stats: DashboardStat[] = [
    { title: 'Загальний прибуток', value: `₴${totalProfit.toFixed(2)}`, icon: CurrencyDollarIcon, color: 'green', isLoading: isLoading },
    { title: 'Всього замовлень', value: orders.length.toString(), icon: OrdersIcon, color: 'rose', isLoading: isLoading },
    { title: 'Активні клієнти', value: customers.length.toString(), icon: UsersIcon, color: 'sky', isLoading: isLoading },
    { title: 'Кількість менеджерів', value: managedUsers.length.toString(), icon: UsersIcon, color: 'indigo', isLoading: isLoading },
  ];

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          (user?.role === 'admin' || stat.title !== 'Кількість менеджерів') && <DashboardCard key={stat.title} {...stat} isLoading={stat.isLoading} />
        ))}
      </div>
      
      {user?.role === 'admin' && (
        <ProfitReportChart report={managerReport} isLoading={isLoading} />
      )}
    </div>
  );
};

export default DashboardPage;