
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { authenticatedFetch } from '../utils/api';
import { Order, SalesDataPoint, TopProduct, TopCustomer, PaginatedResponse } from '../types';
import { ChartBarIcon, CurrencyDollarIcon, UsersIcon, DownloadIcon } from '../components/Icons';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper to format date as YYYY-MM-DD
const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

// Helper to create a date range for the chart (UTC-aware)
const getDateRange = (start: string, end: string): string[] => {
    const dates = [];
    if (!start || !end || new Date(start) > new Date(end)) return [];

    let currentDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);

    while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
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
                    <div key={index} className="flex-1 flex flex-col justify-end items-center group min-w-[10px]">
                        <div className="relative w-full h-full flex items-end justify-center">
                             <div className="absolute -top-6 bg-slate-700 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                ₴{point.totalSales.toFixed(2)}
                            </div>
                            <div
                                className="w-3/4 bg-rose-400 hover:bg-rose-500 rounded-t-md transition-all duration-200 ease-in-out"
                                style={{ height: `${barHeight}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-500 mt-2 text-center w-full">{data.length <= 15 ? new Date(point.date + 'T00:00:00Z').toLocaleDateString('uk-UA', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}</span>
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
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [activePreset, setActivePreset] = useState<number | null>(30);
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 29);
        return toYYYYMMDD(date);
    });
    const [endDate, setEndDate] = useState<string>(toYYYYMMDD(new Date()));

    const handleSetPreset = (days: number) => {
        setActivePreset(days);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - (days - 1));
        setStartDate(toYYYYMMDD(start));
        setEndDate(toYYYYMMDD(end));
    };

    const handleDateChange = (type: 'start' | 'end', value: string) => {
        setActivePreset(null);
        if (type === 'start') {
            setStartDate(value);
        } else {
            setEndDate(value);
        }
    };
    
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
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
        if (!startDate || !endDate) return [];
        
        const startUTC = new Date(`${startDate}T00:00:00.000Z`);
        const endUTC = new Date(`${endDate}T23:59:59.999Z`);
        
        return orders.filter(order => {
            const orderDate = new Date(order.date);
            return orderDate >= startUTC && orderDate <= endUTC;
        });
    }, [orders, startDate, endDate]);

    const reportStats = useMemo(() => {
        let totalRevenue = 0;
        let totalProfit = 0;

        filteredOrders.forEach(order => {
            totalRevenue += order.totalAmount;

            order.items.forEach(item => {
                const retailPriceUAH = item.price * (1 - (item.discount || 0) / 100);
                const costUAH = (item.salonPriceUsd || 0) * (item.exchangeRate || 0);
                if (costUAH > 0) {
                   totalProfit += (retailPriceUAH - costUAH) * item.quantity;
                }
            });
        });

        return {
            totalRevenue,
            totalProfit,
            totalOrders: filteredOrders.length,
        };
    }, [filteredOrders]);

    const salesByDay = useMemo<SalesDataPoint[]>(() => {
        if (!startDate || !endDate) return [];
        const dates = getDateRange(startDate, endDate);
        const salesMap = new Map<string, number>();

        filteredOrders.forEach(order => {
            const orderDate = new Date(order.date).toISOString().split('T')[0];
            salesMap.set(orderDate, (salesMap.get(orderDate) || 0) + order.totalAmount);
        });

        return dates.map(date => ({
            date: date,
            totalSales: salesMap.get(date) || 0,
        }));
    }, [filteredOrders, startDate, endDate]);

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

    const handleDownloadPdf = async () => {
        const reportContentElement = document.getElementById('report-content');
        if (!reportContentElement) {
            setError('Не вдалося знайти вміст звіту для завантаження.');
            return;
        }
        setIsPdfLoading(true);
        setError(null);
        try {
            const canvas = await html2canvas(reportContentElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: reportContentElement.scrollWidth,
                windowHeight: reportContentElement.scrollHeight,
            });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4',
            });
    
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
    
            let imgWidth = pdfWidth - 40; // margin
            let imgHeight = imgWidth / ratio;
            
            if (imgHeight > pdfHeight - 40) {
                imgHeight = pdfHeight - 40;
                imgWidth = imgHeight * ratio;
            }
    
            const x = (pdfWidth - imgWidth) / 2;
            const y = 20;
    
            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`Romanova_Cosmetics_Report_${startDate}_to_${endDate}.pdf`);
    
        } catch (err) {
            console.error("Failed to generate PDF:", err);
            setError("Сталася помилка під час створення PDF. Спробуйте ще раз.");
        } finally {
            setIsPdfLoading(false);
        }
    };
    
    if (isLoading) {
        return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div><p className="ml-4 text-slate-600">Завантаження звітів...</p></div>;
    }
    
    if (error) {
        return <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex-shrink-0">Звіти</h2>
                <div className="w-full flex flex-col sm:flex-row items-center justify-end gap-2 flex-wrap">
                    {[7, 30, 90].map(days => (
                        <button key={days} onClick={() => handleSetPreset(days)}
                            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activePreset === days ? 'bg-white text-rose-600 shadow-sm ring-1 ring-inset ring-slate-200' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            Ост. {days} днів
                        </button>
                    ))}
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={e => handleDateChange('start', e.target.value)} className="p-1.5 border border-slate-300 rounded-md text-sm"/>
                        <span className="text-slate-500">-</span>
                        <input type="date" value={endDate} onChange={e => handleDateChange('end', e.target.value)} max={toYYYYMMDD(new Date())} className="p-1.5 border border-slate-300 rounded-md text-sm"/>
                    </div>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isPdfLoading}
                        className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-70 disabled:cursor-wait"
                    >
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        {isPdfLoading ? 'Створення PDF...' : 'Завантажити PDF'}
                    </button>
                </div>
            </div>
            
            <div id="report-content" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-center">
                        <p className="text-sm font-medium text-slate-500">Загальний дохід</p>
                        <p className="text-3xl font-bold text-slate-800 mt-1">₴{reportStats.totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-center">
                        <p className="text-sm font-medium text-slate-500">Загальний прибуток</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">₴{reportStats.totalProfit.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-center">
                        <p className="text-sm font-medium text-slate-500">Кількість замовлень</p>
                        <p className="text-3xl font-bold text-slate-800 mt-1">{reportStats.totalOrders}</p>
                    </div>
                </div>

                <ReportCard title={`Динаміка продажів (${new Date(startDate + 'T00:00:00Z').toLocaleDateString('uk-UA', { timeZone: 'UTC' })} - ${new Date(endDate + 'T00:00:00Z').toLocaleDateString('uk-UA', { timeZone: 'UTC' })})`} icon={ChartBarIcon}>
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
        </div>
    );
};

export default ReportsPage;
