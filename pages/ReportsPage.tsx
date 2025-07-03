
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { authenticatedFetch } from '../utils/api';
import { Order, SalesDataPoint, TopProduct, TopCustomer, PaginatedResponse } from '../types';
import { ChartBarIcon, CurrencyDollarIcon, UsersIcon } from '../components/Icons';

// Helper to get the last N days
const getLastNDates = (n: number) => {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
    }
    return dates;
};

const ReportCard: React.FC<{ title: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center text-lg font-semibold text-slate-800 mb-4">
            <Icon className="w-6 h-6 mr-3 text-rose-500" />
            <h3>{title}</h3>
        </div>
        {children}
    </div>
);

const SalesChart: React.FC<{ data: SalesDataPoint[] }> = ({ data }) => {
    const maxValue = useMemo(() => Math.max(...data.map(d => d.totalSales), 0), [data]);

    if (data.every(d => d.totalSales === 0)) {
        return <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg">Дані про продажі за цей період відсутні.</div>;
    }

    return (
        <div className="h-72 flex items-end justify-around p-4 bg-slate-50/75 rounded-lg border border-slate-200/80 space-x-2">
            {data.map((point, index) => {
                const barHeight = maxValue > 0 ? (point.totalSales / maxValue) * 100 : 0;
                return (
                    <div key={index} className="flex-1 flex flex-col justify-end items-center group">
                        <div className="relative w-full h-full flex items-end justify-center">
                            <div
                                className="w-3/4 bg-rose-400 hover:bg-rose-500 rounded-t-md transition-all duration-200 ease-in-out"
                                style={{ height: `${barHeight}%` }}
                                title={`₴${point.totalSales.toFixed(2)}`}
                            />
                        </div>
                        <span className="text-xs text-slate-500 mt-2 transform -rotate-45 sm:rotate-0 truncate">{new Date(point.date).toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' })}</span>
                    </div>
                );
            })}
        </div>
    );
};

const TopList: React.FC<{ items: (TopProduct | TopCustomer)[]; type: 'product' | 'customer' }> = ({ items, type }) => {
    if (items.length === 0) {
        return <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg">Дані відсутні.</div>;
    }

    return (
        <ul className="space-y-3">
            {items.map((item, index) => (
                <li key={'productId' in item ? item.productId : item.customerId} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center truncate">
                        <span className="text-sm font-bold text-slate-500 w-6 mr-2">{index + 1}.</span>
                        <p className="font-medium text-slate-800 truncate">{'productName' in item ? item.productName : item.customerName}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                        {type === 'product' && 'totalRevenue' in item && (
                            <>
                                <p className="font-bold text-slate-800">₴{item.totalRevenue.toFixed(2)}</p>
                                <p className="text-xs text-slate-500">{item.totalQuantity} шт.</p>
                            </>
                        )}
                        {type === 'customer' && 'totalSpent' in item && (
                             <>
                                <p className="font-bold text-slate-800">₴{item.totalSpent.toFixed(2)}</p>
                                <p className="text-xs text-slate-500">{item.orderCount} замов.</p>
                            </>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
};


const ReportsPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<number>(30); // 7, 30, 90 days

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch all orders for the report
            const ordersRes = await authenticatedFetch('/api/orders?pageSize=10000');
            if (!ordersRes.ok) throw new Error('Failed to fetch orders.');

            const ordersPaginated: PaginatedResponse<Order> = await ordersRes.json();
            setOrders(ordersPaginated.data || []);
        } catch (err: any) {
            setError(err.message || 'An error occurred while fetching report data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredOrders = useMemo(() => {
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - timeframe);
        return orders.filter(order => new Date(order.date) >= cutoffDate);
    }, [orders, timeframe]);

    const salesByDay = useMemo<SalesDataPoint[]>(() => {
        const dates = getLastNDates(timeframe);
        const salesMap = new Map<string, number>();

        filteredOrders.forEach(order => {
            const orderDate = order.date.split('T')[0];
            salesMap.set(orderDate, (salesMap.get(orderDate) || 0) + order.totalAmount);
        });

        return dates.map(date => ({
            date: date,
            totalSales: salesMap.get(date) || 0,
        }));
    }, [filteredOrders, timeframe]);

    const topProducts = useMemo<TopProduct[]>(() => {
        const productsMap = new Map<string, TopProduct>();
        filteredOrders.forEach(order => {
            order.items.forEach(item => {
                const existing = productsMap.get(item.productId);
                const revenue = item.quantity * item.price * (1 - (item.discount || 0) / 100);
                if (existing) {
                    existing.totalQuantity += item.quantity;
                    existing.totalRevenue += revenue;
                } else {
                    productsMap.set(item.productId, {
                        productId: item.productId,
                        productName: item.productName,
                        totalQuantity: item.quantity,
                        totalRevenue: revenue,
                    });
                }
            });
        });
        return Array.from(productsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    }, [filteredOrders]);

    const topCustomers = useMemo<TopCustomer[]>(() => {
        const customersMap = new Map<string, TopCustomer>();
         filteredOrders.forEach(order => {
            const existing = customersMap.get(order.customerId);
             if (existing) {
                existing.totalSpent += order.totalAmount;
                existing.orderCount += 1;
            } else {
                customersMap.set(order.customerId, {
                    customerId: order.customerId,
                    customerName: order.customerName,
                    totalSpent: order.totalAmount,
                    orderCount: 1,
                });
            }
        });
        return Array.from(customersMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
    }, [filteredOrders]);
    
    if (isLoading) {
        return <div className="text-center p-8">Завантаження звітів...</div>;
    }
    
    if (error) {
        return <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Звіти</h2>
                <div className="bg-slate-100 p-1 rounded-lg flex space-x-1 mt-3 sm:mt-0">
                    {[7, 30, 90].map(days => (
                        <button key={days} onClick={() => setTimeframe(days)}
                            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${timeframe === days ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600 hover:bg-white/50'}`}
                        >
                            Останні {days} днів
                        </button>
                    ))}
                </div>
            </div>
            
            <ReportCard title={`Динаміка продажів за останні ${timeframe} днів`} icon={ChartBarIcon}>
                <SalesChart data={salesByDay} />
            </ReportCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <ReportCard title="Топ-10 товарів за виручкою" icon={CurrencyDollarIcon}>
                    <TopList items={topProducts} type="product" />
                </ReportCard>
                 <ReportCard title="Топ-10 клієнтів за сумою замовлень" icon={UsersIcon}>
                    <TopList items={topCustomers} type="customer" />
                </ReportCard>
            </div>
        </div>
    );
};

export default ReportsPage;
