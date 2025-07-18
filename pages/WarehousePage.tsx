import React, { useState, useEffect, useCallback } from 'react';
import { Product, PaginatedResponse } from '../types';
import { PencilIcon, CheckIcon, XMarkIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';

type EditingState = {
    [productId: string]: {
        value: string;
        isLoading: boolean;
    };
};

const WarehousePage: React.FC = () => {
    const [products, setProducts] = useState<Partial<Product>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const [editingState, setEditingState] = useState<EditingState>({});

    const API_BASE_URL = '/api/warehouse';

    const fetchWarehouseProducts = useCallback(async (page = 1, size = pageSize, search = searchTerm) => {
        setIsLoading(true);
        setPageError(null);
        try {
            const query = new URLSearchParams({ page: String(page), pageSize: String(size), search });
            const response = await authenticatedFetch(`${API_BASE_URL}?${query.toString()}`);
            if (!response.ok) {
                throw new Error((await response.json()).message || 'Failed to fetch warehouse stock.');
            }
            const data: PaginatedResponse<Partial<Product>> = await response.json();
            setProducts(data.data);
            setTotalCount(data.totalCount);
            setCurrentPage(data.currentPage);
        } catch (err: any) {
            setPageError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [pageSize, searchTerm]);

    useEffect(() => {
        fetchWarehouseProducts(currentPage, pageSize, searchTerm);
    }, [currentPage, pageSize, searchTerm, fetchWarehouseProducts]);
    
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => setCurrentPage(page);
    const handlePageSizeChange = (size: number) => setPageSize(size);

    const startEditing = (product: Partial<Product>) => {
        if (!product.id) return;
        setEditingState(prev => ({
            ...prev,
            [product.id!]: { value: String(product.quantity ?? 0), isLoading: false },
        }));
    };

    const cancelEditing = (productId: string) => {
        setEditingState(prev => {
            const newState = { ...prev };
            delete newState[productId];
            return newState;
        });
    };

    const handleQuantityChange = (productId: string, value: string) => {
        setEditingState(prev => ({
            ...prev,
            [productId]: { ...prev[productId], value },
        }));
    };

    const saveQuantity = async (productId: string) => {
        const { value } = editingState[productId];
        const newQuantity = parseInt(value, 10);

        if (isNaN(newQuantity) || newQuantity < 0) {
            // Optionally show an error to the user
            return;
        }

        setEditingState(prev => ({ ...prev, [productId]: { ...prev[productId], isLoading: true } }));

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/${productId}`, {
                method: 'PUT',
                body: JSON.stringify({ quantity: newQuantity }),
            });
            if (!response.ok) {
                throw new Error((await response.json()).message || 'Failed to update quantity.');
            }
            const updatedProduct: Product = await response.json();
            setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
            cancelEditing(productId);
        } catch (err: any) {
            setPageError(`Could not update quantity for product ${productId}: ${err.message}`);
        } finally {
             setEditingState(prev => ({ ...prev, [productId]: { ...prev[productId], isLoading: false } }));
        }
    };
    

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Керування складом</h2>

            <input
                type="search"
                placeholder="Пошук за назвою товару..."
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                value={searchTerm}
                onChange={handleSearchChange}
            />

            {pageError && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg">{pageError}</div>}

            <div className="bg-white shadow-sm rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Назва товару</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Група</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 tracking-wider w-48">Кількість</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 tracking-wider w-32">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center py-10 text-slate-500">Завантаження залишків...</td></tr>
                            ) : products.length > 0 ? (
                                products.map(product => {
                                    const isEditing = !!editingState[product.id!];
                                    const editInfo = editingState[product.id!];

                                    return (
                                        <tr key={product.id} className={`hover:bg-rose-50/50 transition-colors ${isEditing ? 'bg-rose-50' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{product.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{product.group}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editInfo.value}
                                                        onChange={(e) => handleQuantityChange(product.id!, e.target.value)}
                                                        disabled={editInfo.isLoading}
                                                        className="w-24 p-1.5 text-center border-rose-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500"
                                                        onKeyDown={(e) => e.key === 'Enter' && saveQuantity(product.id!)}
                                                    />
                                                ) : (
                                                    <span className={`font-semibold text-lg ${product.quantity! > 0 ? 'text-slate-800' : 'text-red-500'}`}>
                                                        {product.quantity}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button onClick={() => saveQuantity(product.id!)} disabled={editInfo.isLoading} className="p-2 text-green-600 hover:bg-green-100 rounded-full disabled:opacity-50">
                                                          {editInfo.isLoading ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <CheckIcon className="w-5 h-5" />}
                                                        </button>
                                                        <button onClick={() => cancelEditing(product.id!)} disabled={editInfo.isLoading} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><XMarkIcon className="w-5 h-5"/></button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startEditing(product)} className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full" title="Редагувати кількість">
                                                        <PencilIcon className="w-5 h-5"/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr><td colSpan={4} className="text-center py-10 text-slate-500">Товарів, що відповідають пошуку, не знайдено.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalCount > 0 && <Pagination currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} isLoading={isLoading} />}
            </div>
        </div>
    );
};

export default WarehousePage;