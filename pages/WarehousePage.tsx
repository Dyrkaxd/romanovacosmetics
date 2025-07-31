import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product } from '../types';
import { authenticatedFetch } from '../utils/api';
import { FilterIcon } from '../components/Icons';

type WarehouseProduct = Pick<Product, 'id' | 'name' | 'group' | 'quantity'>;

const productGroups = ['All', 'BDR', 'LA', 'АГ', 'АБ', 'АР', 'без сокращений', 'АФ', 'ДС', 'м8', 'JDA', 'Faith', 'AB', 'ГФ', 'ЕС', 'ГП', 'СД', 'ATA', 'W'];

const WarehousePage: React.FC = () => {
    const [products, setProducts] = useState<WarehouseProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('All');
    
    const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});
    const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await authenticatedFetch('/api/warehouse');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to fetch warehouse data.');
            }
            const { data } = await response.json();
            setProducts(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        if (successMessage) {
          const timer = setTimeout(() => setSuccessMessage(null), 3000);
          return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesGroup = selectedGroup === 'All' || product.group === selectedGroup;
            return matchesSearch && matchesGroup;
        });
    }, [products, searchTerm, selectedGroup]);

    const handleQuantityChange = (productId: string, value: string) => {
        setEditingQuantities(prev => ({ ...prev, [productId]: value }));
    };

    const handleSaveQuantity = async (productId: string) => {
        const newQuantityStr = editingQuantities[productId];
        const originalProduct = products.find(p => p.id === productId);
        if (newQuantityStr === undefined || !originalProduct) return;

        const newQuantity = parseInt(newQuantityStr, 10);
        if (isNaN(newQuantity) || newQuantity < 0) {
            setError('Кількість повинна бути невід\'ємним числом.');
            return;
        }

        if (newQuantity === originalProduct.quantity) {
             // No change, just clear editing state
            const newEditing = { ...editingQuantities };
            delete newEditing[productId];
            setEditingQuantities(newEditing);
            return;
        }

        setSavingStates(prev => ({ ...prev, [productId]: true }));
        setError(null);
        setSuccessMessage(null);
        try {
            const response = await authenticatedFetch(`/api/warehouse/${productId}`, {
                method: 'PUT',
                body: JSON.stringify({ quantity: newQuantity }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to update quantity.');
            }
            // Update local state for immediate feedback
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: newQuantity } : p));
            const newEditing = { ...editingQuantities };
            delete newEditing[productId];
            setEditingQuantities(newEditing);
            setSuccessMessage(`Кількість для "${originalProduct.name}" оновлено.`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSavingStates(prev => ({ ...prev, [productId]: false }));
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Керування складом</h2>

            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>}
            {successMessage && <div role="alert" className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">{successMessage}</div>}

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                <input
                    type="search"
                    placeholder="Пошук за назвою..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/2 lg:w-2/3 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
                <div className="relative w-full md:w-1/2 lg:w-1/3">
                    <FilterIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 transform -translate-y-1/2 pointer-events-none"/>
                    <select
                        value={selectedGroup}
                        onChange={e => setSelectedGroup(e.target.value)}
                        className="w-full appearance-none p-2.5 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    >
                        {productGroups.map(group => (
                            <option key={group} value={group}>{group === 'All' ? 'Всі групи' : group}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white shadow-sm rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Назва товару</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Група</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider w-48">Кількість на складі</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {isLoading ? (
                                <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження даних складу...</td></tr>
                            ) : filteredProducts.length > 0 ? (
                                filteredProducts.map((product) => {
                                    const isEditing = editingQuantities[product.id] !== undefined;
                                    const currentValue = isEditing ? editingQuantities[product.id] : product.quantity;
                                    const isSaving = savingStates[product.id];
                                    
                                    return (
                                        <tr key={product.id} className={`hover:bg-rose-50/50 transition-colors ${isEditing ? 'bg-amber-50' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{product.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                <span className="font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{product.group}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={currentValue}
                                                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveQuantity(product.id)}
                                                        min="0"
                                                        className="w-24 p-2 border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500"
                                                        disabled={isSaving}
                                                    />
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => handleSaveQuantity(product.id)}
                                                            disabled={isSaving}
                                                            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50"
                                                        >
                                                            {isSaving ? '...' : 'Зберегти'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500">
                                    {products.length === 0 ? "На складі немає товарів." : "Товарів, що відповідають фільтрам, не знайдено."}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WarehousePage;