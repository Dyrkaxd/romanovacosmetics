import React, { useState, useEffect, useCallback } from 'react';
import { Expense, PaginatedResponse } from '../types';
import { PlusIcon, XMarkIcon, PencilIcon, TrashIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';

const API_BASE_URL = '/api';

const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];

const ExpensesPage: React.FC = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const initialExpenseState: Partial<Expense> = { name: '', amount: 0, date: toYYYYMMDD(new Date()), notes: '' };
    const [currentExpense, setCurrentExpense] = useState<Partial<Expense>>(initialExpenseState);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    
    const [pageError, setPageError] = useState<string | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);

    const fetchExpenses = useCallback(async (page = 1, size = pageSize, search = searchTerm) => {
        setIsLoading(true);
        setPageError(null);
        try {
            const query = new URLSearchParams({ page: String(page), pageSize: String(size), search });
            const response = await authenticatedFetch(`${API_BASE_URL}/expenses?${query.toString()}`);
            if (!response.ok) {
                throw new Error((await response.json()).message || 'Failed to fetch expenses');
            }
            const data: PaginatedResponse<Expense> = await response.json();
            setExpenses(data.data);
            setTotalCount(data.totalCount);
            setCurrentPage(data.currentPage);
            setPageSize(data.pageSize);
        } catch (err: any) {
            setPageError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [pageSize, searchTerm]);

    useEffect(() => {
        fetchExpenses(1, pageSize, searchTerm);
    }, [fetchExpenses, pageSize, searchTerm]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        fetchExpenses(page, pageSize, searchTerm);
    };
    
    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
        fetchExpenses(1, size, searchTerm);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCurrentExpense(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentExpense.name || !currentExpense.amount || currentExpense.amount <= 0 || !currentExpense.date) {
            setModalError("Назва, дата, та позитивна сума є обов'язковими.");
            return;
        }
        setModalError(null);
        setIsLoading(true);

        try {
            const method = editingExpense ? 'PUT' : 'POST';
            const url = editingExpense ? `${API_BASE_URL}/expenses/${editingExpense.id}` : `${API_BASE_URL}/expenses`;
            const response = await authenticatedFetch(url, { method, body: JSON.stringify(currentExpense) });

            if (!response.ok) {
                throw new Error((await response.json()).message || `Could not ${editingExpense ? 'update' : 'add'} expense.`);
            }
            fetchExpenses(currentPage);
            closeModal();
        } catch (err: any) {
            setModalError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingExpense(null);
        setCurrentExpense(initialExpenseState);
        setIsModalOpen(true);
        setModalError(null);
    };

    const openEditModal = (expense: Expense) => {
        setEditingExpense(expense);
        setCurrentExpense({ ...expense, date: toYYYYMMDD(new Date(expense.date))});
        setIsModalOpen(true);
        setModalError(null);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
        setModalError(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Ви впевнені, що хочете видалити цю витрату?')) {
            setIsLoading(true);
            try {
                const response = await authenticatedFetch(`${API_BASE_URL}/expenses/${id}`, { method: 'DELETE' });
                if (response.status !== 204) {
                    throw new Error((await response.json()).message || 'Could not delete expense.');
                }
                const newTotalCount = totalCount - 1;
                const newTotalPages = Math.ceil(newTotalCount / pageSize);
                const newCurrentPage = currentPage > newTotalPages && newTotalPages > 0 ? newTotalPages : currentPage;
                fetchExpenses(newCurrentPage);
            } catch (err: any) {
                setPageError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Керування витратами</h2>
                <button onClick={openAddModal} className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg">
                    <PlusIcon className="w-5 h-5 mr-2" /> Додати витрату
                </button>
            </div>
            <input
                type="search"
                placeholder="Пошук за назвою або нотатками..."
                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                value={searchTerm}
                onChange={handleSearchChange}
            />
            {pageError && <div role="alert" className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg">{pageError}</div>}
            
            <div className="bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700">
                {/* Desktop Table View */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Назва</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Сума</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Нотатки</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-10 text-slate-500 dark:text-slate-400">Завантаження...</td></tr>
                            ) : expenses.length > 0 ? (
                                expenses.map(exp => (
                                    <tr key={exp.id} className="hover:bg-rose-50/50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">{exp.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">₴{exp.amount.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{new Date(exp.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 truncate max-w-sm">{exp.notes}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                                            <button onClick={() => openEditModal(exp)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleDelete(exp.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"><TrashIcon className="w-5 h-5"/></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} className="text-center py-10 text-slate-500 dark:text-slate-400">Витрат не знайдено.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden">
                    {isLoading ? (
                        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Завантаження...</div>
                    ) : expenses.length > 0 ? (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            {expenses.map(exp => (
                                <li key={exp.id} className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100 pr-4">{exp.name}</p>
                                            <p className="text-sm font-bold text-red-500">₴{exp.amount.toFixed(2)}</p>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center space-x-1">
                                            <button onClick={() => openEditModal(exp)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleDelete(exp.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1 pt-3 border-t dark:border-slate-700">
                                        <p><span className="font-medium">Дата:</span> {new Date(exp.date).toLocaleDateString()}</p>
                                        {exp.notes && <p><span className="font-medium">Нотатки:</span> {exp.notes}</p>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Витрат не знайдено.</div>
                    )}
                </div>

                {totalCount > 0 && <Pagination currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} isLoading={isLoading} />}
            </div>

            {isModalOpen && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-lg">
                        <div className="flex justify-between items-center pb-4 mb-6 border-b dark:border-slate-700">
                            <h3 className="text-xl font-semibold dark:text-slate-100">{editingExpense ? 'Редагувати' : 'Додати'} витрату</h3>
                            <button onClick={closeModal} disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-400 dark:hover:text-slate-300"/></button>
                        </div>
                        {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg">{modalError}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Назва</label>
                                <input type="text" name="name" id="name" value={currentExpense.name || ''} onChange={handleInputChange} required className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Сума (₴)</label>
                                    <input type="number" name="amount" id="amount" value={currentExpense.amount || ''} onChange={handleInputChange} required step="0.01" min="0.01" className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg" />
                                </div>
                                <div>
                                    <label htmlFor="date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Дата</label>
                                    <input type="date" name="date" id="date" value={currentExpense.date || ''} onChange={handleInputChange} required className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Нотатки</label>
                                <textarea name="notes" id="notes" value={currentExpense.notes || ''} onChange={handleInputChange} rows={3} className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg" />
                            </div>
                            <div className="flex justify-end pt-6 space-x-3 border-t dark:border-slate-700">
                                <button type="button" onClick={closeModal} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 px-4 rounded-lg" disabled={isLoading}>Скасувати</button>
                                <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white py-2 px-4 rounded-lg" disabled={isLoading}>{isLoading ? 'Збереження...' : 'Зберегти'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesPage;