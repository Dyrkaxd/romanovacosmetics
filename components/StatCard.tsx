import React, { SVGProps } from 'react';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from './Icons';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.FC<SVGProps<SVGSVGElement>>;
    isLoading: boolean;
    change?: number;
    colorClass?: string;
    iconColorClass?: string;
}

const StatCard = ({ title, value, icon: Icon, isLoading, change, colorClass, iconColorClass }: StatCardProps) => {
    const isPositive = change !== undefined && change >= 0;

    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md hover:border-rose-200 dark:hover:border-rose-500/50">
            <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
                <Icon className={`w-7 h-7 ${iconColorClass || 'text-slate-400 dark:text-slate-500'}`} />
            </div>
            {isLoading ? (
                <div className="mt-2 space-y-2">
                    <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse"></div>
                    {change !== undefined && <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse"></div>}
                </div>
            ) : (
                <div className="mt-2">
                    <p className={`text-3xl font-bold ${colorClass || 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
                    {change !== undefined && (
                        <div className="flex items-center text-xs font-semibold mt-1">
                            <span className={`flex items-center ${isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                {isPositive ? <ArrowTrendingUpIcon className="w-4 h-4 mr-1"/> : <ArrowTrendingDownIcon className="w-4 h-4 mr-1"/>}
                                {change.toFixed(1)}%
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 ml-1">vs минулий період</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StatCard;
