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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Звіт по менеджерах</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Ім'я менеджера</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">К-сть замовлень</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider hidden md:table-cell">Сума продажів</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 tracking-wider">Прибуток</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {isLoading ? (
                            <tr><td colSpan={4} className="text-center py-10 text-slate-500">Завантаження звіту...</td></tr>
                        ) : managerReport.length > 0 ? (
                            managerReport.map(manager => (
                                <tr key={manager.email}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{manager.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">{manager.totalOrders}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden md:table-cell text-right">₴{manager.totalSales.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold text-right">₴{manager.totalProfit.toFixed(2)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={4} className="text-center py-10 text-slate-500">Дані для звіту відсутні.</td></tr>
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