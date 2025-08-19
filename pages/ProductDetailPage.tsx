import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { authenticatedFetch } from '../utils/api';
import { ArrowLeftIcon, PencilIcon, ArchiveBoxIcon, CurrencyDollarIcon } from '../components/Icons';

const DetailItem: React.FC<{ label: string; value: string | number; valueClass?: string; }> = ({ label, value, valueClass }) => (
    <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`text-lg font-semibold text-slate-800 dark:text-slate-100 ${valueClass}`}>{value}</p>
    </div>
);

const ProductDetailPage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const [product, setProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!productId) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await authenticatedFetch(`/api/products/${productId}`);
            if (!response.ok) {
                throw new Error((await response.json()).message || 'Не вдалося завантажити дані товару.');
            }
            const data: Product = await response.json();
            setProduct(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return <div className="text-center py-10">Завантаження даних товару...</div>;
    }

    if (error) {
        return <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>;
    }

    if (!product) {
        return <div className="text-center py-10">Товар не знайдено.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                 <button onClick={() => navigate('/products')} className="flex items-center text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    До списку товарів
                </button>
                 <button onClick={() => navigate('/products', { state: { openEditId: product.id }})} className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg">
                    <PencilIcon className="w-4 h-4 mr-2"/>
                    Редагувати
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row justify-between md:items-center pb-4 mb-4 border-b dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{product.name}</h2>
                    <span className="font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full text-sm mt-2 md:mt-0">{product.group}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                     <DetailItem 
                        label="Кількість на складі" 
                        value={product.quantity} 
                        valueClass="flex items-center"
                    />
                    <DetailItem 
                        label="Ціна роздрібна ($)" 
                        value={`$${product.retailPrice.toFixed(2)}`}
                        valueClass="text-green-600"
                    />
                    <DetailItem 
                        label="Ціна салону ($)" 
                        value={`$${product.salonPrice.toFixed(2)}`}
                        valueClass="text-blue-600"
                    />
                    <DetailItem 
                        label="Поточний курс" 
                        value={`${product.exchangeRate.toFixed(2)} ₴/$`}
                    />
                     <DetailItem 
                        label="Роздрібна ціна (₴)" 
                        value={`₴${(product.retailPrice * product.exchangeRate).toFixed(2)}`}
                         valueClass="text-green-600"
                    />
                     <DetailItem 
                        label="Ціна салону (₴)" 
                        value={`₴${(product.salonPrice * product.exchangeRate).toFixed(2)}`}
                         valueClass="text-blue-600"
                    />
                </div>
                 <div className="mt-6 pt-6 border-t dark:border-slate-700 text-xs text-slate-400">
                    ID Товару: {product.id}
                </div>
            </div>
        </div>
    );
};

export default ProductDetailPage;
