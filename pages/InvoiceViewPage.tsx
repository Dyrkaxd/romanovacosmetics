import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Order, Customer } from '../types';
import { PrinterIcon, ShareIcon, ArrowLeftIcon } from '../components/Icons';
import { logoBase64 } from '../assets/logo';

const InvoiceViewPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);

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

    const handleBack = () => {
        navigate(-1); // Go back to the previous page (likely the orders list)
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2500); // Reset after 2.5 seconds
        }, (err) => {
            console.error('Could not copy link: ', err);
            alert('Не вдалося скопіювати посилання.');
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-950">
                <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-600 dark:text-slate-300 text-lg mt-4 font-medium">Завантаження рахунку...</p>
            </div>
        );
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-950 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-2xl font-bold text-red-600">Помилка</h2>
                    <p className="text-slate-600 dark:text-slate-300 mt-2">{error}</p>
                </div>
            </div>
        );
    }
    
    if (!order || !customer) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-950">
                <p className="text-slate-600 dark:text-slate-300 text-lg font-medium">Рахунок не знайдено.</p>
            </div>
        );
    }

    const subtotal = order.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const totalDiscount = subtotal - order.totalAmount;

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen py-6 sm:py-12 px-2 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg printable-area">
                <div className="p-4 sm:p-8 lg:p-12 break-words">
                    <header className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b border-slate-200">
                        <div>
                            <img src={logoBase64} alt="Romanova Cosmetics Logo" className="h-16 w-16 mb-4" />
                            <h1 className="text-3xl font-bold text-slate-800">ROMANOVA</h1>
                            <p className="text-slate-500">Cosmetics</p>
                        </div>
                        <div className="text-left sm:text-right mt-4 sm:mt-0">
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
                    <section className="overflow-x-auto">
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
                       <p className="text-slate-500 text-sm">Ваша краса - наше натхнення. Дякуємо за довіру!</p>
                       <p className="text-sm font-semibold text-slate-600 mt-1">ROMANOVA Cosmetics</p>
                    </footer>
                </div>
            </div>
            <div className="p-4 flex flex-col sm:flex-row justify-center items-center gap-4 no-print mt-8">
                <button
                    onClick={handleBack}
                    className="flex items-center justify-center bg-slate-500 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg shadow-sm transition-colors w-full sm:w-auto"
                >
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    Назад
                </button>
                <button
                    onClick={handleCopyLink}
                    className="flex items-center justify-center bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg shadow-sm transition-colors w-full sm:w-auto"
                >
                    <ShareIcon className="w-5 h-5 mr-2" />
                    {isCopied ? 'Скопійовано!' : 'Копіювати посилання'}
                </button>
                 <button
                    onClick={handlePrint}
                    className="flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-6 rounded-lg shadow-sm transition-colors w-full sm:w-auto"
                >
                    <PrinterIcon className="w-5 h-5 mr-2" />
                    Друк / PDF
                </button>
            </div>
        </div>
    );
};

export default InvoiceViewPage;