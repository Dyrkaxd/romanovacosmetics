

import React from 'react';
import { Link } from 'react-router-dom';
import { GlobalSearchResult } from '../types';
import { OrdersIcon, UsersIcon, ProductsIcon } from './Icons';

interface GlobalSearchResultsProps {
  results: GlobalSearchResult[];
  isLoading: boolean;
  query: string;
  onResultClick: () => void;
}

const ResultItem: React.FC<{ result: GlobalSearchResult, onClick: () => void }> = ({ result, onClick }) => {
    const getIcon = (type: GlobalSearchResult['type']) => {
        switch(type) {
            case 'order': return <OrdersIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />;
            case 'customer': return <UsersIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />;
            case 'product': return <ProductsIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />;
        }
    }
    
    return (
        <Link to={result.url} onClick={onClick} className="block p-3 hover:bg-rose-50 dark:hover:bg-slate-700/50 rounded-md transition-colors">
             <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 pt-0.5">
                    {getIcon(result.type)}
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{result.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{result.description}</p>
                </div>
             </div>
        </Link>
    )
};


const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({ results, isLoading, query, onResultClick }) => {
  const categorizedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<GlobalSearchResult['type'], GlobalSearchResult[]>);

  const categoryTitles: Record<GlobalSearchResult['type'], string> = {
    order: 'Замовлення',
    customer: 'Клієнти',
    product: 'Товари',
  };

  const hasResults = results.length > 0;
  
  return (
    <div className="absolute top-full mt-2 w-full max-w-lg bg-white dark:bg-slate-800 rounded-lg shadow-xl z-30 ring-1 ring-black dark:ring-slate-700 ring-opacity-5">
      <div className="p-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
        {isLoading ? 'Шукаю...' : (hasResults ? `Результати для "${query}"` : `Немає результатів для "${query}"`)}
      </div>
      {isLoading ? (
        <div className="p-4">
             <div className="w-full h-8 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse"></div>
        </div>
      ) : hasResults ? (
        <div className="max-h-96 overflow-y-auto p-2 space-y-2">
            {Object.entries(categorizedResults).map(([type, items]) => (
                <div key={type}>
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase px-3 py-1">{categoryTitles[type as GlobalSearchResult['type']]}</h4>
                    <ul className="space-y-1">
                        {items.map(item => (
                            <li key={item.id}><ResultItem result={item} onClick={onResultClick} /></li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
      ) : (
         <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
             <p>Спробуйте пошукати за ID замовлення, іменем клієнта або назвою товару.</p>
             <p className="text-xs mt-2">Ви також можете використовувати природну мову, наприклад, "останні замовлення Олени".</p>
         </div>
      )}
    </div>
  );
};

export default GlobalSearchResults;