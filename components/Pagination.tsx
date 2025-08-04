

import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading: boolean;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalCount, pageSize, onPageChange, onPageSizeChange, isLoading }) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalCount === 0) {
    return null; // Don't render pagination if there are no items
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(Number(e.target.value));
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 sm:px-6 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
      <div className="flex items-center space-x-2 mb-3 sm:mb-0">
        <label htmlFor="pageSize" className="text-sm font-medium text-slate-700 dark:text-slate-300">Рядків на сторінці:</label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={handlePageSizeChange}
          disabled={isLoading}
          className="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 dark:text-slate-200 dark:bg-slate-700 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-rose-600 sm:text-sm sm:leading-6 disabled:opacity-50"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      
      <div className="flex items-center space-x-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <span className="font-medium">{startItem}</span>
          -
          <span className="font-medium">{endItem}</span>
          {' '}з{' '}
          <span className="font-medium">{totalCount}</span>
        </p>

        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1 || isLoading}
            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Previous</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
          </button>
          
           <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 ring-1 ring-inset ring-slate-300 dark:ring-slate-600">
             Сторінка {currentPage} з {totalPages}
           </span>

          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages || isLoading}
            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Next</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Pagination;