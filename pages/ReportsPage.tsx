import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authenticatedFetch } from '../utils/api';
import { ReportData, SalesDataPoint, TopProduct, TopCustomer, RevenueByGroup, Expense } from '../types';
import { ChartBarIcon, CurrencyDollarIcon, UsersIcon, DownloadIcon, LightBulbIcon } from '../components/Icons';


// Helper to format date as YYYY-MM-DD
const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

const StatCard: React.FC<{ title: string; value: string; subValue?: string, isLoading: boolean; colorClass?: string, tooltipText?: string }> = ({ title, value, subValue, isLoading, colorClass = 'text-slate-800 dark:text-slate-100', tooltipText }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative group">
        {tooltipText && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                {tooltipText}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800"></div>
            </div>
        )}
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        {isLoading ? (
            <div className="h-9 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-md mt-1 animate-pulse"></div>
        ) : (
            <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
        )}
        {subValue && !isLoading && <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">{subValue}</p>}
    </div>
);

const ReportSalesProfitChart: React.FC<{ data: SalesDataPoint[], isLoading: boolean }> = ({ data, isLoading }) => {
    const chartRef = useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

    const chartMetrics = useMemo(() => {
        const maxSales = Math.max(...data.map(d => d.totalSales), 0);
        const maxProfit = Math.max(...data.map(d => d.totalProfit), 0);
        const overallMax = Math.max(maxSales, maxProfit, 1); // Avoid division by zero
        
        if (data.length < 2) return { salesPath: '', profitPath: '', points: [], overallMax };
        
        const points = data.map((point, index) => ({
            x: (index / (data.length - 1)) * 100,
            salesY: 100 - (overallMax > 0 ? (point.totalSales / overallMax) * 95 : 0),
            profitY: 100 - (overallMax > 0 ? (point.totalProfit / overallMax) * 95 : 0),
            date: new Date(point.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
            sales: point.totalSales,
            profit: point.totalProfit,
        }));

        const salesPath = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x.toFixed(2)},${p.salesY.toFixed(2)}`).join(' ');
        const profitPath = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x.toFixed(2)},${p.profitY.toFixed(2)}`).join(' ');

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

    if (isLoading) return <div className="h-80 w-full bg-white dark:bg-slate-800 rounded-lg animate-pulse"></div>;

    const noData = data.every(d => d.totalSales === 0 && d.totalProfit === 0);
    if (noData) {
        return <div className="h-80 flex items-center justify-center text-center py-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg">Дані про продажі та прибуток за цей період відсутні.</div>;
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 h-full">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Динаміка продажів і валового прибутку</h3>
            <div className="relative h-80" onMouseLeave={() => setTooltip(null)}>
                <svg ref={chartRef} viewBox="0 0 100 105" className="w-full h-full" preserveAspectRatio="none" onMouseMove={handleMouseMove}>
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(y => (
                       <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" className="text-slate-100 dark:text-slate-700" strokeWidth="0.3"/>
                    ))}
                    <path d={chartMetrics.salesPath} fill="none" stroke="#f43f5e" strokeWidth="0.7" strokeLinejoin="round" strokeLinecap="round" />
                    <path d={chartMetrics.profitPath} fill="none" stroke="#16a34a" strokeWidth="0.7" strokeLinejoin="round" strokeLinecap="round" />
                    
                    {tooltip && chartRef.current && <line x1={tooltip.x / chartRef.current.getBoundingClientRect().width * 100} y1="0" x2={tooltip.x / chartRef.current.getBoundingClientRect().width * 100} y2="100" stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="0.3" strokeDasharray="2"/>}
                </svg>
                {tooltip && (
                    <div className="absolute p-2 bg-slate-800 text-white text-xs rounded-md shadow-lg pointer-events-none" style={{ left: tooltip.x, top: tooltip.y, transform: `translate(-50%, -120%)` }}>
                        {tooltip.content}
                    </div>
                )}
            </div>
             <div className="flex justify-center space-x-4 mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                <span className="flex items-center"><span className="w-3 h-3 bg-rose-500 rounded-full mr-2"></span>Дохід</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>Валовий прибуток</span>
            </div>
        </div>
    );
};

const RevenueDonutChart: React.FC<{ data: RevenueByGroup[], isLoading: boolean }> = ({ data, isLoading }) => {
    const COLORS = ['#e11d48', '#3b82f6', '#16a34a', '#f97316', '#8b5cf6', '#db2777', '#0891b2', '#ca8a04'];
    const [hoveredIndex, setHoveredIndex] = useState<number | undefined>(undefined);

    const { chartData, gradientStyle } = useMemo(() => {
        const sortedData = [...data].sort((a, b) => b.revenue - a.revenue);
        const totalRevenue = sortedData.reduce((sum, item) => sum + item.revenue, 0);
        
        if (totalRevenue === 0) {
            return { chartData: [], gradientStyle: { background: '#f1f5f9' } };
        }

        let accumulatedPercentage = 0;
        const gradientParts: string[] = [];
        const chartSegments = sortedData.map((segment, index) => {
            const percentage = (segment.revenue / totalRevenue);
            const startPercentage = accumulatedPercentage;
            accumulatedPercentage += percentage;
            const endPercentage = accumulatedPercentage;
            
            const color = COLORS[index % COLORS.length];
            gradientParts.push(`${color} ${startPercentage * 100}% ${endPercentage * 100}%`);
            
            return { ...segment, percentage, color, index };
        });

        const gradientStyle = { background: `conic-gradient(${gradientParts.join(', ')})` };

        return { chartData: chartSegments, gradientStyle };
    }, [data]);

    if (isLoading) {
        return <div className="h-80 bg-white dark:bg-slate-800 rounded-lg animate-pulse"></div>;
    }
    if (data.length === 0 || chartData.length === 0) {
        return <div className="h-80 flex items-center justify-center text-center py-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg">Дані по групах товарів відсутні.</div>;
    }
    
    const activeSegment = hoveredIndex !== undefined ? chartData.find(d => d.index === hoveredIndex) : null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center h-80">
            <div className="relative w-full h-full flex items-center justify-center" onMouseLeave={() => setHoveredIndex(undefined)}>
                <div 
                    className="w-48 h-48 rounded-full transition-all duration-300"
                    style={gradientStyle}
                >
                </div>
                {/* Center text overlay */}
                <div className="absolute w-32 h-32 bg-white dark:bg-slate-800 rounded-full flex flex-col items-center justify-center text-center p-2 shadow-inner">
                     <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                        {activeSegment ? `${(activeSegment.percentage * 100).toFixed(1)}%` : 'Дохід'}
                     </span>
                     {activeSegment && (
                        <span className="text-slate-500 dark:text-slate-400 text-sm truncate">
                            {activeSegment.group}
                        </span>
                     )}
                </div>
            </div>
            <ul className="space-y-2 pr-2 overflow-y-auto max-h-[280px]">
                {chartData.map((segment) => (
                     <li key={segment.index}
                        className="flex items-center justify-between text-sm p-2 rounded-md transition-colors"
                        style={{ 
                            backgroundColor: hoveredIndex === segment.index ? `${segment.color}20` : 'transparent',
                            opacity: hoveredIndex === undefined || hoveredIndex === segment.index ? 1 : 0.5
                        }}
                        onMouseOver={() => setHoveredIndex(segment.index)}
                        onMouseOut={() => setHoveredIndex(undefined)}
                    >
                        <div className="flex items-center truncate">
                            <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: segment.color }} />
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{segment.group}</span>
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 ml-2 flex-shrink-0">{(segment.percentage * 100).toFixed(1)}%</span>
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
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i}>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4 mb-2 animate-pulse"></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
                    </div>
                ))}
            </div>
        );
    }
    
    if (items.length === 0) {
        return <div className="h-full flex items-center justify-center text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg">Дані відсутні.</div>;
    }

    return (
        <ul className="space-y-4">
            {items.map(item => {
                const value = 'totalRevenue' in item ? item.totalRevenue : item.totalSpent;
                const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const name = 'productName' in item ? item.productName : item.customerName;
                const key = 'productId' in item ? item.productId : item.customerId;

                return (
                    <li key={key}>
                        <div className="flex justify-between items-center mb-1.5">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-4">{name}</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-100 flex-shrink-0 text-sm">₴{value.toFixed(2)}</p>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className="bg-rose-400 h-2 rounded-full" style={{ width: `${barWidth}%` }}></div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

const AIAnalysisCard: React.FC<{ analysis: string | null; isLoading: boolean; error: string | null; onRegenerate: () => void; }> = ({ analysis, isLoading, error, onRegenerate }) => {
    return (
        <div className="bg-gradient-to-br from-amber-50 to-rose-50 dark:from-slate-800 dark:to-slate-850 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex space-x-4">
            <div className="p-3 rounded-full bg-white/70 dark:bg-slate-700/50 h-fit">
                <LightBulbIcon className="w-7 h-7 text-amber-500" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">AI-Аналіз Звіту</p>
                    <button onClick={onRegenerate} disabled={isLoading} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait" aria-label="Оновити AI-аналітику">
                        <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-11.667 0l-3.181 3.183m0 0l-3.181-3.183m11.667 0l3.181-3.183" /></svg>
                    </button>
                </div>
                {isLoading ? (
                    <div className="space-y-2 mt-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6 animate-pulse"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/6 animate-pulse"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse"></div>
                    </div>
                ) : error ? (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 p-3 rounded-md">{error}</p>
                ) : (
                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{analysis}</p>
                )}
            </div>
        </div>
    );
};

const ExpensesTable: React.FC<{ expenses: Expense[], isLoading: boolean }> = ({ expenses, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-700 rounded-md mb-4 animate-pulse"></div>
                <div className="space-y-2">
                    <div className="h-10 bg-slate-50 dark:bg-slate-700/50 rounded-lg animate-pulse"></div>
                    <div className="h-10 bg-slate-50 dark:bg-slate-700/50 rounded-lg animate-pulse"></div>
                    <div className="h-10 bg-slate-50 dark:bg-slate-700/50 rounded-lg animate-pulse"></div>
                </div>
            </div>
        );
    }

    if (expenses.length === 0) {
        return (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Витрати за період</h3>
                <div className="h-full flex items-center justify-center text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg">Витрат за цей період не знайдено.</div>
            </div>
        );
    }
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Витрати за період</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Дата</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Назва</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider hidden md:table-cell">Нотатки</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Сума</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {expenses.map((expense) => (
                            <tr key={expense.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{new Date(expense.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">{expense.name}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 hidden md:table-cell truncate max-w-sm">{expense.notes || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-red-600">₴{expense.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');
            
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
        return <div role="alert" className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex-shrink-0">Звіти</h2>
                <div className="w-full flex flex-col sm:flex-row items-center justify-end gap-2 flex-wrap">
                    {[7, 30, 90].map(days => (
                        <button key={days} onClick={() => handleSetPreset(days)} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activePreset === days ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-inset ring-slate-200 dark:ring-slate-700' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            Ост. {days} днів
                        </button>
                    ))}
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={e => handleDateChange('start', e.target.value)} className="p-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-md text-sm"/>
                        <span className="text-slate-500 dark:text-slate-400">-</span>
                        <input type="date" value={endDate} onChange={e => handleDateChange('end', e.target.value)} max={toYYYYMMDD(new Date())} className="p-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-md text-sm"/>
                    </div>
                    <button onClick={handleDownloadPdf} disabled={isPdfLoading || isLoading} className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-70 disabled:cursor-wait">
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        {isPdfLoading ? 'Створення PDF...' : 'Завантажити PDF'}
                    </button>
                </div>
            </div>
            
            <div id="report-content-wrapper" ref={reportContentRef} className="bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 rounded-2xl">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Звіт про прибутки та збитки</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        за період з {new Date(startDate).toLocaleDateString('uk-UA')} по {new Date(endDate).toLocaleDateString('uk-UA')}
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Дохід (отримано)" 
                            value={`₴${(reportData?.totalRevenue ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                            isLoading={isLoading} 
                            subValue={`${(reportData?.totalOrders ?? 0)} замовлень`}
                            tooltipText="Загальна сума грошей, отримана від клієнтів за замовленнями зі статусом 'Отримано' протягом вибраного періоду. Це дохід до вирахування будь-яких витрат."
                        />
                        <StatCard 
                            title="Валовий прибуток" 
                            value={`₴${(reportData?.grossProfit ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                            isLoading={isLoading} 
                            colorClass="text-blue-600 dark:text-blue-400"
                            tooltipText="Дохід мінус собівартість проданих товарів (ціна салону). Цей показник демонструє прибутковість основної діяльності до врахування операційних витрат."
                        />
                        <StatCard 
                            title="Витрати" 
                            value={`₴${(reportData?.totalExpenses ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                            isLoading={isLoading} 
                            colorClass="text-red-600 dark:text-red-500"
                            tooltipText="Сума всіх операційних витрат, зафіксованих у системі за вибраний період. Включає оренду, маркетинг, зарплати тощо."
                        />
                        <StatCard 
                            title="Чистий прибуток" 
                            value={`₴${(reportData?.totalProfit ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                            isLoading={isLoading} 
                            colorClass="text-green-600 dark:text-green-500"
                            tooltipText="Фінальний фінансовий результат. Розраховується як Дохід мінус Витрати. Це гроші, які ви заробили."
                        />
                    </div>

                    <AIAnalysisCard 
                        analysis={aiAnalysis} 
                        isLoading={isAiLoading} 
                        error={aiError} 
                        onRegenerate={() => reportData && fetchAiAnalysis(reportData)}
                    />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ReportSalesProfitChart data={reportData?.salesByDay || []} isLoading={isLoading} />
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Розподіл доходу за групами</h3>
                             <RevenueDonutChart data={reportData?.revenueByGroup || []} isLoading={isLoading}/>
                        </div>
                    </div>
                    
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Топ-10 товарів за доходом</h3>
                             <TopList items={reportData?.topProducts || []} type="product" isLoading={isLoading} />
                        </div>
                         <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Топ-10 клієнтів за витратами</h3>
                             <TopList items={reportData?.topCustomers || []} type="customer" isLoading={isLoading} />
                        </div>
                    </div>

                    <ExpensesTable expenses={reportData?.expenses || []} isLoading={isLoading} />
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
