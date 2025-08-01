

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { Order, Customer } from '../types';
import { PrinterIcon } from '../components/Icons';
import { logoBase64 } from '../assets/logo';

const BillOfLadingViewPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<Order | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrderData = async () => {
            if (!orderId) {
                setError("ID замовлення не вказано.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                // This is a public API endpoint
                const res = await fetch(`/api/orders/${orderId}`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || `Не вдалося завантажити ТТН. Можливо, посилання застаріло.`);
                }
                const { order: orderData, customer: customerData } = await res.json();
                
                if (!orderData || !customerData) {
                    throw new Error('Отримано неповні дані для ТТН.');
                }
                
                setOrder(orderData);
                setCustomer(customerData);

            } catch (err: any) {
                setError(err.message || 'Сталася невідома помилка.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrderData();
    }, [orderId]);

    const handlePrint = () => {
        if (!order) return;
        const originalTitle = document.title;
        // TTN is the common Ukrainian abbreviation for Bill of Lading
        document.title = `TTN_${order.id}`;

        const restoreTitle = () => {
            document.title = originalTitle;
            window.removeEventListener('afterprint', restoreTitle);
        };

        window.addEventListener('afterprint', restoreTitle);
        
        window.print();
        
        // Fallback timeout
        setTimeout(restoreTitle, 500);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
                <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-600 text-lg mt-4 font-medium">Завантаження ТТН...</p>
            </div>
        );
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-2xl font-bold text-red-600">Помилка</h2>
                    <p className="text-slate-600 mt-2">{error}</p>
                </div>
            </div>
        );
    }
    
    if (!order || !customer) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
                <p className="text-slate-600 text-lg font-medium">ТТН не знайдено.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 min-h-screen py-6 sm:py-12 px-2 sm:px-6 lg:px-8 printable-area">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg">
                <div className="p-4 sm:p-8 lg:p-12 break-words">
                    <header className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b border-slate-200">
                        <div>
                            <img src={logoBase64} alt="Romanova Cosmetics Logo" className="h-16 w-16 mb-4" />
                            <h1 className="text-2xl font-bold text-slate-800">ROMANOVA</h1>
                            <p className="text-slate-500">Cosmetics</p>
                        </div>
                        <div className="text-left sm:text-right mt-4 sm:mt-0">
                             <h2 className="text-xl sm:text-2xl font-bold text-slate-700 uppercase tracking-wider">Товарно-транспортна накладна (ТТН)</h2>
                             <p className="text-slate-500 mt-2">до замовлення #{order.id.substring(0,8)}</p>
                             <p className="text-slate-500">від {new Date(order.date).toLocaleDateString('uk-UA')}</p>
                        </div>
                    </header>
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-8 pb-8 border-b border-slate-200">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Вантажовідправник</h3>
                            <p className="mt-2 font-semibold text-slate-800">ROMANOVA Cosmetics</p>
                            <p className="text-slate-600">вул. Торгова 1, м. Київ, 01001</p>
                            <p className="text-slate-600">samsonenkoroma@gmail.com</p>
                        </div>
                        <div className="text-left sm:text-right">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Вантажоодержувач</h3>
                            <p className="mt-2 font-semibold text-slate-800">{customer.name}</p>
                            <p className="text-slate-600">{customer.address.street}</p>
                            <p className="text-slate-600">{customer.address.city}, {customer.address.state} {customer.address.zip}</p>
                        </div>
                    </section>
                    <section className="overflow-x-auto">
                         <h3 className="text-lg font-semibold text-slate-800 mb-4">Відомості про вантаж</h3>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-slate-600 w-10">#</th>
                                    <th className="p-3 text-sm font-semibold text-slate-600">Найменування вантажу</th>
                                    <th className="p-3 text-sm font-semibold text-slate-600 text-center">Кількість місць</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, index) => (
                                    <tr key={item.id} className="border-b border-slate-100">
                                        <td className="p-3 text-slate-600">{index + 1}</td>
                                        <td className="p-3">
                                            <p className="font-medium text-slate-800">{item.productName}</p>
                                        </td>
                                        <td className="p-3 text-center text-slate-800 font-medium">{item.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                             <tfoot className="bg-slate-50">
                                <tr>
                                    <td colSpan={2} className="p-3 text-right font-bold text-slate-800">Всього місць:</td>
                                    <td className="p-3 text-center font-bold text-slate-800 text-lg">
                                        {order.items.reduce((total, item) => total + item.quantity, 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                    <footer className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-12 mt-12 border-t border-slate-200 text-sm">
                        <div>
                            <p className="text-slate-800">Здав (підпис відправника)</p>
                            <div className="mt-12 border-b border-slate-400"></div>
                            <p className="text-slate-500 text-xs text-center">(підпис, ПІБ, посада)</p>
                        </div>
                         <div>
                            <p className="text-slate-800">Прийняв (підпис одержувача)</p>
                            <div className="mt-12 border-b border-slate-400"></div>
                             <p className="text-slate-500 text-xs text-center">(підпис, ПІБ)</p>
                        </div>
                    </footer>
                </div>
            </div>
            <div className="p-4 flex justify-center no-print mt-8">
                <button
                    onClick={handlePrint}
                    className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-6 rounded-lg shadow-sm transition-colors"
                >
                    <PrinterIcon className="w-5 h-5 mr-2" />
                    Роздрукувати / Зберегти як PDF
                </button>
            </div>
        </div>
    );
};

export default BillOfLadingViewPage;