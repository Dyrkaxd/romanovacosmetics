
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authenticatedFetch } from '../utils/api';
import { ReportData, SalesDataPoint, TopProduct, TopCustomer, RevenueByGroup } from '../types';
import { ChartBarIcon, CurrencyDollarIcon, UsersIcon, DownloadIcon, LightBulbIcon } from '../components/Icons';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper to format date as YYYY-MM-DD
const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

const StatCard: React.FC<{ title: string; value: string; subValue?: string, isLoading: boolean; colorClass?: string }> = ({ title, value, subValue, isLoading, colorClass = 'text-slate-800' }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {isLoading ? (
            <div className="h-9 w-3/4 bg-slate-200 rounded-md mt-1 animate-pulse"></div>
        ) : (
            <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
        )}
        {subValue && !isLoading && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
    </div>
);

const SalesLineChart: React.FC<{ data: SalesDataPoint[], isLoading: boolean }> = ({ data, isLoading }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

    const chartData = useMemo(() => {
        const maxValue = Math.max(...data.map(d => d.totalSales), 0);
        const points = data.map((point, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - (maxValue > 0 ? (point.totalSales / maxValue) * 90 : 0); // 90% to leave space at top
            return { x, y, date: point.date, sales: point.totalSales };
        });
        const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x},${p.y}`).join(' ');
        return { points, path, maxValue };
    }, [data]);
    
    if (isLoading) {
        return <div className="h-80 bg-slate-50 rounded-lg animate-pulse"></div>;
    }
    if (data.every(d => d.totalSales === 0)) {
        return <div className="h-80 flex items-center justify-center text-center py-10 text-slate-500 bg-slate-50 rounded-lg">Дані про продажі за цей період відсутні.</div>;
    }

    return (
        <div className="relative h-80 bg-slate-50/75 rounded-lg p-4">
            <svg ref={svgRef} viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0"/>
                    </linearGradient>
                </defs>
                <path d={chartData.path + ' V 100 H 0 Z'} fill="url(#salesGradient)" stroke="none" />
                <path d={chartData.path} fill="none" stroke="#f43f5e" strokeWidth="0.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
        </div>
    );
};

const RevenueDonutChart: React.FC<{ data: RevenueByGroup[], isLoading: boolean }> = ({ data, isLoading }) => {
    const COLORS = ['#e11d48', '#3b82f6', '#16a34a', '#f97316', '#8b5cf6', '#db2777', '#0891b2', '#ca8a04'];
    const [hoveredIndex, setHoveredIndex] = useState<number | undefined>(undefined);

    const chartData = useMemo(() => {
        const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
        let accumulated = 0;
        return data.map((segment, index) => {
            const percentage = totalRevenue > 0 ? segment.revenue / totalRevenue : 0;
            const angle = percentage * 360;
            const startAngle = accumulated;
            accumulated += angle;
            return { ...segment, percentage, angle, startAngle, color: COLORS[index % COLORS.length] };
        }).sort((a,b) => b.revenue - a.revenue);
    }, [data]);

    if (isLoading) {
        return <div className="h-80 bg-slate-50 rounded-lg animate-pulse"></div>;
    }
    if (data.length === 0) {
        return <div className="h-80 flex items-center justify-center text-center py-10 text-slate-500 bg-slate-50 rounded-lg">Дані по групах товарів відсутні.</div>;
    }

    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center h-80">
            <div className="relative w-full h-full">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {chartData.map((segment, index) => (
                        <circle
                            key={index}
                            cx="50" cy="50" r={radius}
                            fill="transparent"
                            stroke={segment.color}
                            strokeWidth="12"
                            strokeDasharray={`${segment.percentage * circumference} ${circumference}`}
                            strokeDashoffset={-segment.startAngle / 360 * circumference}
                            className="transition-all duration-300 ease-in-out"
                            style={{ opacity: hoveredIndex === undefined || hoveredIndex === index ? 1 : 0.3 }}
                            onMouseOver={() => setHoveredIndex(index)}
                            onMouseOut={() => setHoveredIndex(undefined)}
                        />
                    ))}
                    <text x="50" y="52" textAnchor="middle" dominantBaseline="middle" className="transform rotate-90 origin-center fill-slate-800 font-bold text-[8px]">
                        {hoveredIndex !== undefined ? `${chartData[hoveredIndex].percentage * 100toFixed(1)}%` : 'Дохід'}
                    </text>
                     {hoveredIndex !== undefined &&
                        <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" className="transform rotate-90 origin-center fill-slate-500 text-[5px] truncate">
                            {chartData[hoveredIndex].group}
                        </text>
                    }
                </svg>
            </div>
            <ul className="space-y-2 pr-2 overflow-y-auto max-h-[280px]">
                {chartData.map((segment, index) => (
                     <li key={index}
                        className="flex items-center justify-between text-sm p-2 rounded-md transition-colors"
                        style={{ backgroundColor: hoveredIndex === index ? `${segment.color}20` : 'transparent' }}
                        onMouseOver={() => setHoveredIndex(index)}
                        onMouseOut={() => setHoveredIndex(undefined)}
                    >
                        <div className="flex items-center truncate">
                            <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: segment.color }} />
                            <span className="font-medium text-slate-700 truncate">{segment.group}</span>
                        </div>
                        <span className="font-semibold text-slate-800 ml-2 flex-shrink-0">{(segment.percentage * 100).toFixed(1)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const TopList: React.FC<{ items: (TopProduct | TopCustomer)[], type: 'product' | 'customer', isLoading: boolean }> = ({ items, type, isLoading }) => {
    const maxValue = useMemo(() => {
        if (items.length === 0) return 0;
        return Math.max(...items.map(i => 'totalRevenue' in i ? i.totalRevenue : i.totalSpent));
    }, [items]);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse"></div>)}
            </div>
        );
    }
    if (items.length === 0) {
        return <div className="h-full flex items-center justify-center text-center py-10 text-slate-500 bg-slate-50 rounded-lg">Дані відсутні.</div>;
    }

    return (
        <ul className="space-y-3">
            {items.map(item => {
                const value = 'totalRevenue' in item ? item.totalRevenue : item.totalSpent;
                const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
                return (
                    <li key={'productId' in item ? item.productId : item.customerId} className="space-y-1">
                        <div className="flex justify-between items-baseline text-sm">
                           <p className="font-medium text-slate-700 truncate pr-4">{'productName' in item ? item.productName : item.customerName}</p>
                           <p className="font-semibold text-slate-800 flex-shrink-0">₴{value.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-100 rounded-full h-2.5">
                            <div className="bg-rose-400 h-2.5 rounded-full" style={{ width: `${barWidth}%` }}></div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

const AIAnalysisCard: React.FC<{ analysis: string | null; isLoading: boolean; error: string | null; onRegenerate: () => void; }> = ({ analysis, isLoading, error, onRegenerate }) => {
    return (
        <div className="bg-gradient-to-br from-amber-50 to-rose-50 p-6 rounded-xl shadow-sm border border-slate-200 flex space-x-4">
            <div className="p-3 rounded-full bg-white/70 h-fit">
                <LightBulbIcon className="w-7 h-7 text-amber-500" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-slate-500 font-medium">AI-Аналіз Звіту</p>
                    <button onClick={onRegenerate} disabled={isLoading} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait" aria-label="Оновити AI-аналітику">
                        <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-11.667 0l-3.181 3.183m0 0l-3.181-3.183m11.667 0l3.181-3.183" /></svg>
                    </button>
                </div>
                {isLoading ? (
                    <div className="space-y-2 mt-2">
                        <div className="h-4 bg-slate-200 rounded w-5/6 animate-pulse"></div>
                        <div className="h-4 bg-slate-200 rounded w-4/6 animate-pulse"></div>
                        <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse"></div>
                    </div>
                ) : error ? (
                    <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>
                ) : (
                    <p className="text-slate-700 font-medium leading-relaxed">{analysis}</p>
                )}
            </div>
        </div>
    );
};


const ReportsPage: React.FC = () => {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(true);
    
    const [error, setError] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const [activePreset, setActivePreset] = useState<number | null>(30);
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 29);
        return toYYYYMMDD(date);
    });
    const [endDate, setEndDate] = useState<string>(toYYYYMMDD(new Date()));
    
    const reportContentRef = useRef<HTMLDivElement>(null);

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
        if (type === 'start') setStartDate(value);
        else setEndDate(value);
    };

    const fetchAiAnalysis = useCallback(async (data: ReportData) => {
        setIsAiLoading(true);
        setAiError(null);
        try {
            const res = await authenticatedFetch('/api/reportAnalysis', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'AI analysis failed.');
            }
            const result = await res.json();
            setAiAnalysis(result.analysis);
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsAiLoading(false);
        }
    }, []);

    const fetchData = useCallback(async (start: string, end: string) => {
        setIsLoading(true);
        setError(null);
        setReportData(null);
        try {
            const reportRes = await authenticatedFetch(`/api/reports?startDate=${start}&endDate=${end}`);
            if (!reportRes.ok) {
                const errData = await reportRes.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to fetch report data.');
            }
            const data: ReportData = await reportRes.json();
            setReportData(data);
            fetchAiAnalysis(data); // Trigger AI analysis after fetching data
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [fetchAiAnalysis]);

    useEffect(() => {
        if (startDate && endDate && new Date(startDate) <= new Date(endDate)) {
            fetchData(startDate, endDate);
        }
    }, [startDate, endDate, fetchData]);

    const handleDownloadPdf = async () => {
        if (!reportContentRef.current) return;
        setIsPdfLoading(true);
        setError(null);
        try {
            const canvas = await html2canvas(reportContentRef.current, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth(), pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width, canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            let imgWidth = pdfWidth - 40, imgHeight = imgWidth / ratio;
            if (imgHeight > pdfHeight - 40) {
                imgHeight = pdfHeight - 40;
                imgWidth = imgHeight * ratio;
            }
            pdf.addImage(imgData, 'PNG', (pdfWidth - imgWidth) / 2, 20, imgWidth, imgHeight);
            pdf.save(`Romanova_Cosmetics_Report_${startDate}_to_${endDate}.pdf`);
        } catch (err) {
            console.error("Failed to generate PDF:", err);
            setError("Сталася помилка під час створення PDF. Спробуйте ще раз.");
        } finally {
            setIsPdfLoading(false);
        }
    };

    if (error) {
        return <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex-shrink-0">Звіти</h2>
                <div className="w-full flex flex-col sm:flex-row items-center justify-end gap-2 flex-wrap">
                    {[7, 30, 90].map(days => (
                        <button key={days} onClick={() => handleSetPreset(days)} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activePreset === days ? 'bg-white text-rose-600 shadow-sm ring-1 ring-inset ring-slate-200' : 'text-slate-600 hover:bg-slate-100'}`}>
                            Ост. {days} днів
                        </button>
                    ))}
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={e => handleDateChange('start', e.target.value)} className="p-1.5 border border-slate-300 rounded-md text-sm"/>
                        <span className="text-slate-500">-</span>
                        <input type="date" value={endDate} onChange={e => handleDateChange('end', e.target.value)} max={toYYYYMMDD(new Date())} className="p-1.5 border border-slate-300 rounded-md text-sm"/>
                    </div>
                    <button onClick={handleDownloadPdf} disabled={isPdfLoading || isLoading} className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-70 disabled:cursor-wait">
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        {isPdfLoading ? 'Створення PDF...' : 'Завантажити PDF'}
                    </button>
                </div>
            </div>
            
            <div id="report-content-wrapper" ref={reportContentRef} className="bg-slate-50 p-4 sm:p-6 rounded-2xl">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Загальний дохід" value={`₴${(reportData?.totalRevenue ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} isLoading={isLoading} />
                        <StatCard title="Загальний прибуток" value={`₴${(reportData?.totalProfit ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} isLoading={isLoading} colorClass="text-green-600" />
                        <StatCard title="Кількість замовлень" value={(reportData?.totalOrders ?? 0).toString()} isLoading={isLoading} />
                        <AIAnalysisCard analysis={aiAnalysis} isLoading={isAiLoading} error={aiError} onRegenerate={() => reportData && fetchAiAnalysis(reportData)} />
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Динаміка продажів</h3>
                        <SalesLineChart data={reportData?.salesByDay || []} isLoading={isLoading} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                             <h3 className="text-lg font-semibold text-slate-800 mb-4">Топ-10 товарів за виручкою</h3>
                             <TopList items={reportData?.topProducts || []} type="product" isLoading={isLoading} />
                        </div>
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                             <h3 className="text-lg font-semibold text-slate-800 mb-4">Розподіл доходу за групами товарів</h3>
                             <RevenueDonutChart data={reportData?.revenueByGroup || []} isLoading={isLoading} />
                        </div>
                    </div>
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Топ-10 клієнтів за сумою замовлень</h3>
                        <TopList items={reportData?.topCustomers || []} type="customer" isLoading={isLoading} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
