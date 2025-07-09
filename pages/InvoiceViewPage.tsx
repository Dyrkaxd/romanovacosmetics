

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { Order, Customer } from '../types';
import { PrinterIcon } from '../components/Icons';
import { logoBase64 } from '../assets/logo';

const InvoiceViewPage: React.FC = () => {
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
                    const errData = await res.json().catch(()=>({}));
                    throw new Error(errData.message || `Не вдалося завантажити рахунок. Можливо, посилання застаріло.`);
                }
                const { order: orderData, customer: customerData } = await res.json();
                
                if (!orderData || !customerData) {
                    throw new Error('Отримано неповні дані про рахунок.');
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
        document.title = `Invoice_${order.id}`;

        const restoreTitle = () => {
            document.title = originalTitle;
            window.removeEventListener('afterprint', restoreTitle);
        };

        window.addEventListener('afterprint', restoreTitle);
        
        window.print();

        // A timeout fallback for browsers that might not fire 'afterprint' reliably
        setTimeout(restoreTitle, 500);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
                <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-600 text-lg mt-4 font-medium">Завантаження рахунку...</p>
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
                <p className="text-slate-600 text-lg font-medium">Рахунок не знайдено.</p>
            </div>
        );
    }

    const subtotal = order.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const totalDiscount = subtotal - order.totalAmount;

    return (
        <div className="bg-slate-100 min-h-screen py-12 px-4 sm:px-6 lg:px-8 printable-area">
            <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg">
                <div className="p-8 sm:p-12 break-words">
                    <header className="flex justify-between items-start pb-8 border-b border-slate-200">
                        <div>
                            <img src={logoBase64} alt="Romanova Cosmetics Logo" className="h-16 w-16 mb-4" />
                            <h1 className="text-3xl font-bold text-slate-800">ROMANOVA</h1>
                            <p className="text-slate-500">Cosmetics</p>
                        </div>
                        <div className="text-right">
                             <h2 className="text-3xl font-bold text-rose-600 uppercase tracking-wider">Рахунок</h2>
                             <p className="text-slate-500 mt-2">#{order.id.substring(0,8)}</p>
                        </div>
                    </header>
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-8">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Виставлено для</h3>
                            <p className="mt-2 text-lg font-semibold text-slate-800">{customer.name}</p>
                            <p className="text-slate-600">{customer.address.street}</p>
                            <p className="text-slate-600">{customer.address.city}, {customer.address.state} {customer.address.zip}</p>
                            <p className="text-slate-600">{customer.email}</p>
                        </div>
                        <div className="text-left sm:text-right">
                             <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Дата рахунку</h3>
                             <p className="mt-2 text-slate-700">{new Date(order.date).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </section>
                    <section>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-slate-600">Товар</th>
                                    <th className="p-3 text-sm font-semibold text-slate-600 text-center">К-сть</th>
                                    <th className="p-3 text-sm font-semibold text-slate-600 text-right">Ціна</th>
                                    <th className="p-3 text-sm font-semibold text-slate-600 text-right">Всього</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map(item => (
                                    <tr key={item.id} className="border-b border-slate-100">
                                        <td className="p-3">
                                            <p className="font-medium text-slate-800">{item.productName}</p>
                                            {item.discount > 0 && <p className="text-xs text-red-500">Знижка: {item.discount}%</p>}
                                        </td>
                                        <td className="p-3 text-center text-slate-600">{item.quantity}</td>
                                        <td className="p-3 text-right text-slate-600">₴{item.price.toFixed(2)}</td>
                                        <td className="p-3 text-right text-slate-800 font-medium">₴{(item.quantity * item.price * (1 - (item.discount || 0)/100)).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    <section className="mt-8 flex justify-end">
                        <div className="w-full sm:w-1/2">
                           <div className="flex justify-between text-slate-600 py-2">
                               <span>Проміжна сума</span>
                               <span>₴{subtotal.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between text-slate-600 py-2">
                               <span>Знижка</span>
                               <span className="text-red-500">-₴{totalDiscount.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between text-slate-800 font-bold text-xl py-4 border-t-2 border-slate-200">
                               <span>Всього</span>
                               <span>₴{order.totalAmount.toFixed(2)}</span>
                           </div>
                        </div>
                    </section>
                    <footer className="text-center pt-8 mt-8 border-t border-slate-200">
                       <p className="text-slate-500 text-sm">Дякуємо за ваш бізнес!</p>
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

export default InvoiceViewPage;