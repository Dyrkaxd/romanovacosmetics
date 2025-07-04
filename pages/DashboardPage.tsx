
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardStat, ManagerStats } from '../types';
import { OrdersIcon, UsersIcon, CurrencyDollarIcon, LightBulbIcon, ArrowPathIcon } from '../components/Icons'; 
import { authenticatedFetch } from '../utils/api';
import { useAuth } from '../AuthContext';

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

const AISummaryCard: React.FC<{ summary: string; isLoading: boolean; error: string | null; onRegenerate: () => void; }> = ({ summary, isLoading, error, onRegenerate }) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex space-x-4">
      <div className="p-3 rounded-full bg-amber-50 h-fit">
        <LightBulbIcon className="w-7 h-7 text-amber-500" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-slate-500 font-medium">AI-аналітика продажів</p>
            <button
              onClick={onRegenerate}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait"
              aria-label="Оновити AI-аналітику"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
        {isLoading ? (
          <div className="space-y-2 mt-2">
            <div className="h-4 bg-slate-200 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded w-4/6 animate-pulse"></div>
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>
        ) : (
          <p className="text-slate-700 font-medium leading-relaxed">{summary}</p>
        )}
      </div>
    </div>
  );
};

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

interface DashboardStatsData {
    totalProfit: number;
    totalOrders: number;
    totalCustomers: number;
    totalManagers: number;
    managerReport: ManagerStats[];
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<DashboardStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<string>('');
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/dashboardSummary`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch AI summary.' }));
        throw new Error(errorData.message);
      }
      const data = await response.json();
      setSummary(data.summary);
    } catch (err: any) {
      setSummaryError(err.message || 'Could not load AI summary.');
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);


  const fetchDashboardData = useCallback(async () => {
    if (user?.role !== 'admin') {
        setIsLoading(false);
        return; 
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/dashboardStats');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `An error occurred: ${response.statusText}` }));
        throw new Error(errorData.message);
      }
      const data: DashboardStatsData = await response.json();
      setStatsData(data);
      fetchSummary();
    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err.message || 'Could not load dashboard statistics.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.role, fetchSummary]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);


  const stats: DashboardStat[] = [
    { title: 'Загальний прибуток', value: `₴${(statsData?.totalProfit || 0).toFixed(2)}`, icon: CurrencyDollarIcon, color: 'green', isLoading: isLoading },
    { title: 'Всього замовлень', value: (statsData?.totalOrders || 0).toString(), icon: OrdersIcon, color: 'rose', isLoading: isLoading },
    { title: 'Активні клієнти', value: (statsData?.totalCustomers || 0).toString(), icon: UsersIcon, color: 'sky', isLoading: isLoading },
    { title: 'Кількість менеджерів', value: (statsData?.totalManagers || 0).toString(), icon: UsersIcon, color: 'indigo', isLoading: isLoading },
  ];

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>}
      
      {user?.role === 'admin' && (
        <AISummaryCard 
          summary={summary} 
          isLoading={isSummaryLoading}
          error={summaryError}
          onRegenerate={fetchSummary}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          (user?.role === 'admin' || stat.title !== 'Кількість менеджерів') && <DashboardCard key={stat.title} {...stat} isLoading={isLoading || !statsData} />
        ))}
      </div>
      
      {user?.role === 'admin' && (
        <ProfitReportChart report={statsData?.managerReport || []} isLoading={isLoading || !statsData} />
      )}
    </div>
  );
};

export default DashboardPage;