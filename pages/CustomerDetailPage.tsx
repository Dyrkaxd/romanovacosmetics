import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer, Order, PaginatedResponse } from '../types';
import { authenticatedFetch } from '../utils/api';
import { ArrowLeftIcon, PencilIcon, MapPinIcon, UsersIcon } from '../components/Icons';

// Re-using StatusPill component logic here for simplicity
const orderStatusTranslations: Record<Order['status'], string> = {
  Ordered: 'Замовлено', Shipped: 'Відправлено', Received: 'Отримано', Calculation: 'Прорахунок',
  AwaitingApproval: 'На погодженні', PaidByClient: 'Сплачено клієнтом', WrittenOff: 'Списано', ReadyForPickup: 'Готово для видачі',
};
const StatusPill: React.FC<{ status: Order['status'] }> = ({ status }) => {
  const styles: Record<Order['status'], string> = {
    Ordered: 'bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
    Shipped: 'bg-blue-100 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20',
    Received: 'bg-green-100 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-400/20',
    Calculation: 'bg-indigo-100 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-400/20',
    AwaitingApproval: 'bg-purple-100 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-400/20',
    PaidByClient: 'bg-teal-100 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-400/20',
    WrittenOff: 'bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
    ReadyForPickup: 'bg-lime-100 text-lime-700 ring-lime-600/20 dark:bg-lime-500/10 dark:text-lime-400 dark:ring-lime-400/20',
  };
  return (
    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ring-1 ring-inset ${styles[status]}`}>
      {orderStatusTranslations[status] || status}
    </span>
  );
};

const MailIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);

const PhoneIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
  </svg>
);

const DetailItem: React.FC<{ icon: React.FC<React.SVGProps<SVGSVGElement>>, label: string, value?: string, href?: string }> = ({ icon: Icon, label, value, href }) => (
    <div className="flex items-start">
        <Icon className="w-5 h-5 text-slate-400 mt-0.5 mr-3 flex-shrink-0" />
        <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-slate-700 dark:text-slate-200 font-medium hover:text-rose-600 dark:hover:text-rose-400 break-all">{value || 'Н/Д'}</a>
            ) : (
              <p className="text-slate-700 dark:text-slate-200 font-medium break-all">{value || 'Н/Д'}</p>
            )}
        </div>
    </div>
);

const CustomerDetailPage: React.FC = () => {
    const { customerId } = useParams<{ customerId: string }>();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const fetchData = useCallback(async () => {
        if (!customerId) return;
        setIsLoading(true);
        setError(null);
        try {
            const [customerRes, ordersRes] = await Promise.all([
                authenticatedFetch(`/api/customers/${customerId}`),
                authenticatedFetch(`/api/orders?customerId=${customerId}&pageSize=1000`)
            ]);

            if (!customerRes.ok) {
                throw new Error((await customerRes.json()).message || 'Не вдалося завантажити дані клієнта.');
            }
             if (!ordersRes.ok) {
                throw new Error((await ordersRes.json()).message || 'Не вдалося завантажити історію замовлень.');
            }

            const customerData: Customer = await customerRes.json();
            const ordersData: PaginatedResponse<Order> = await ordersRes.json();
            
            setCustomer(customerData);
            setOrders(ordersData.data);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return <div className="text-center py-10">Завантаження даних клієнта...</div>;
    }

    if (error) {
        return <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{error}</div>;
    }

    if (!customer) {
        return <div className="text-center py-10">Клієнта не знайдено.</div>;
    }

    const fullAddress = [
        customer.address.street,
        customer.address.city,
        customer.address.state,
        customer.address.zip,
        customer.address.country
    ].filter(Boolean).join(', ');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                 <button onClick={() => navigate('/customers')} className="flex items-center text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    До списку клієнтів
                </button>
                 <button onClick={() => navigate('/customers', { state: { openEditId: customer.id }})} className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg">
                    <PencilIcon className="w-4 h-4 mr-2"/>
                    Редагувати
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row items-start md:items-center">
                    <div className="flex-shrink-0 w-20 h-20 bg-rose-500 text-white flex items-center justify-center rounded-full text-3xl font-bold">
                        {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="mt-4 md:mt-0 md:ml-6">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{customer.name}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Клієнт з {new Date(customer.joinDate).toLocaleDateString('uk-UA')}</p>
                    </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 mt-6 border-t dark:border-slate-700">
                    <DetailItem icon={MailIcon} label="Email" value={customer.email} href={`mailto:${customer.email}`} />
                    <DetailItem icon={PhoneIcon} label="Телефон" value={customer.phone} href={`tel:${customer.phone}`} />
                    <DetailItem icon={MapPinIcon} label="Адреса" value={fullAddress} />
                    {customer.instagramHandle && <DetailItem icon={UsersIcon} label="Instagram" value={customer.instagramHandle} href={`https://instagram.com/${customer.instagramHandle.replace('@', '')}`} />}
                    {customer.viberNumber && <DetailItem icon={PhoneIcon} label="Viber" value={customer.viberNumber} href={`viber://chat?number=%2B${customer.viberNumber.replace(/\D/g, '')}`} />}
                </div>
                {customer.notes && (
                    <div className="mt-6 pt-6 border-t dark:border-slate-700">
                        <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Нотатки</h4>
                        <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{customer.notes}</p>
                    </div>
                )}
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Історія замовлень ({orders.length})</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                             <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Статус</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300">Сума</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                           {orders.length > 0 ? (
                                orders.map(order => (
                                    <tr key={order.id} className="hover:bg-rose-50/50 dark:hover:bg-slate-700/50 cursor-pointer" onClick={() => navigate('/orders', { state: { openOrderId: order.id } })}>
                                        <td className="px-6 py-4 font-semibold text-rose-600 dark:text-rose-400">#{order.id.substring(0,8)}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{new Date(order.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4"><StatusPill status={order.status} /></td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-100">₴{order.totalAmount.toFixed(2)}</td>
                                    </tr>
                                ))
                           ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-10 text-slate-500 dark:text-slate-400">У цього клієнта ще немає замовлень.</td>
                                </tr>
                           )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CustomerDetailPage;