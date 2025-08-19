import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ManagerStats } from '../types';
import { authenticatedFetch } from '../utils/api';
import { UsersIcon, CurrencyDollarIcon, OrdersIcon } from '../components/Icons';
import StatCard from '../components/StatCard';

type SortKey = keyof ManagerStats | 'name';
type SortOrder = 'asc' | 'desc';

const SortableHeader: React.FC<{
  title: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortOrder: SortOrder;
  setSortConfig: (config: { key: SortKey; order: SortOrder }) => void;
}> = ({ title, sortKey, currentSortKey, sortOrder, setSortConfig }) => {
  const isSorting = currentSortKey === sortKey;
  const newSortOrder = isSorting && sortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      onClick={() => setSortConfig({ key: sortKey, order: newSortOrder })}
    >
      <div className="flex items-center">
        <span>{title}</span>
        {isSorting && (
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {sortOrder === 'asc' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            )}
          </svg>
        )}
      </div>
    </th>
  );
};


const ManagerReportPage: React.FC = () => {
  const [stats, setStats] = useState<ManagerStats[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, order: SortOrder }>({ key: 'totalProfit', order: 'desc' });

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/dashboardStats');
      if (!response.ok) {
        throw new Error((await response.json()).message || 'Failed to fetch manager stats.');
      }
      const data = await response.json();
      setStats(data.managerReport || []);
      setTotalProfit(data.totalProfit || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  
  const sortedStats = useMemo(() => {
    let sortableItems = [...stats];
    sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.order === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
    });
    return sortableItems;
  }, [stats, sortConfig]);


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Звіт по ефективності менеджерів</h2>
      
      {error && <div role="alert" className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
            title="Загальний прибуток"
            value={`₴${totalProfit.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}`}
            icon={CurrencyDollarIcon}
            isLoading={isLoading}
            colorClass="text-green-600"
            iconColorClass="text-green-500"
        />
        <StatCard
            title="Загальна кількість замовлень"
            value={`${stats.reduce((acc, s) => acc + s.totalOrders, 0)}`}
            icon={OrdersIcon}
            isLoading={isLoading}
            colorClass="text-blue-600"
            iconColorClass="text-blue-500"
        />
        <StatCard
            title="Кількість менеджерів"
            value={`${stats.length}`}
            icon={UsersIcon}
            isLoading={isLoading}
            colorClass="text-indigo-600"
            iconColorClass="text-indigo-500"
        />
      </div>
      
      <div className="bg-white dark:bg-slate-800 shadow-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
         {/* Desktop Table View */}
         <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <SortableHeader title="Ім'я" sortKey="name" currentSortKey={sortConfig.key} sortOrder={sortConfig.order} setSortConfig={setSortConfig} />
                <SortableHeader title="Email" sortKey="email" currentSortKey={sortConfig.key} sortOrder={sortConfig.order} setSortConfig={setSortConfig} />
                <SortableHeader title="К-сть замовлень" sortKey="totalOrders" currentSortKey={sortConfig.key} sortOrder={sortConfig.order} setSortConfig={setSortConfig} />
                <SortableHeader title="Загальні продажі" sortKey="totalSales" currentSortKey={sortConfig.key} sortOrder={sortConfig.order} setSortConfig={setSortConfig} />
                <SortableHeader title="Загальний прибуток" sortKey="totalProfit" currentSortKey={sortConfig.key} sortOrder={sortConfig.order} setSortConfig={setSortConfig} />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {isLoading ? (
                 <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Завантаження...</td></tr>
              ) : sortedStats.length > 0 ? (
                sortedStats.map((manager) => (
                  <tr key={manager.email} className="hover:bg-rose-50/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">{manager.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{manager.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700 dark:text-slate-200">{manager.totalOrders}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700 dark:text-slate-200">₴{manager.totalSales.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">₴{manager.totalProfit.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  Дані про ефективність менеджерів відсутні.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
            {isLoading ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Завантаження...</div>
            ) : sortedStats.length > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {sortedStats.map(manager => (
                        <li key={manager.email} className="p-4 space-y-3">
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{manager.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{manager.email}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-y-2 text-sm pt-3 border-t border-slate-100 dark:border-slate-700">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Замовлень</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{manager.totalOrders}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-slate-500 dark:text-slate-400">Продажі</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">₴{manager.totalSales.toLocaleString('uk-UA')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 dark:text-slate-400">Прибуток</p>
                                    <p className="font-bold text-green-600 dark:text-green-500">₴{manager.totalProfit.toLocaleString('uk-UA')}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Дані про ефективність менеджерів відсутні.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ManagerReportPage;
