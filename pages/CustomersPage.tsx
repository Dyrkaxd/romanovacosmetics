import React, { useState, useEffect, useCallback } from 'react';
import { Customer, Order, PaginatedResponse } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';
import { useAuth } from '../AuthContext';

const orderStatusValues: Order['status'][] = ['Ordered', 'Shipped', 'Received', 'Calculation', 'AwaitingApproval', 'PaidByClient', 'WrittenOff', 'ReadyForPickup'];
const orderStatusTranslations: Record<Order['status'], string> = {
  Ordered: 'Замовлено',
  Shipped: 'Відправлено',
  Received: 'Отримано',
  Calculation: 'Прорахунок',
  AwaitingApproval: 'На погодженні',
  PaidByClient: 'Сплачено клієнтом',
  WrittenOff: 'Списано',
  ReadyForPickup: 'Готово для видачі',
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


const CustomersPage: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const defaultAddress = { street: '', city: '', state: '', zip: '', country: '' };
  const initialCustomerState: Partial<Customer> = { 
    name: '', 
    email: '', 
    phone: '', 
    instagramHandle: '', 
    viberNumber: '', 
    address: defaultAddress,
    notes: '',
  };
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>(initialCustomerState);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('default');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isCustomerOrdersLoading, setIsCustomerOrdersLoading] = useState(false);
  const [customerOrdersError, setCustomerOrdersError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);


  const API_BASE_URL = '/api';

  const fetchCustomers = useCallback(async (page = 1, size = pageSize, search = searchTerm, sort = filter) => {
    setIsLoading(true);
    setPageError(null);
    setCurrentPage(page);
    try {
       const query = new URLSearchParams({
          page: String(page),
          pageSize: String(size),
          search: search,
          sort: sort,
      });
      const response = await authenticatedFetch(`${API_BASE_URL}/customers?${query.toString()}`);
      if (!response.ok) {
        let errorMessage = `Failed to fetch customers. Status: ${response.status} ${response.statusText}`;
        try {
            const errData = await response.json();
            errorMessage = errData.message || errorMessage;
        } catch (e) { /* ignore json parse error */ }
        throw new Error(errorMessage);
      }
      let data: PaginatedResponse<Customer> = await response.json();
      setCustomers(data.data);
      setTotalCount(data.totalCount);
      setCurrentPage(data.currentPage);
      setPageSize(data.pageSize);

    } catch (err: any) {
      console.error("Failed to fetch customers:", err);
      setPageError(err.message || 'Could not load customers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, searchTerm, filter]);

  useEffect(() => {
    fetchCustomers(currentPage, pageSize, searchTerm, filter);
  }, [fetchCustomers, currentPage, pageSize, searchTerm, filter]);
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(e.target.value);
    setCurrentPage(1); // Reset to first page on new filter
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };
  
  const handlePageChange = (page: number) => {
      setCurrentPage(page);
  };
  
  const handlePageSizeChange = (size: number) => {
      setPageSize(size);
      setCurrentPage(1); // Reset to first page
  };


  const fetchOrdersForCustomer = useCallback(async (customerId: string) => {
    if (!customerId) return;
    setIsCustomerOrdersLoading(true);
    setCustomerOrdersError(null);
    try {
      // Note: This endpoint might also need pagination if a customer can have many orders.
      // For now, fetching all for the modal view.
      const response = await authenticatedFetch(`${API_BASE_URL}/orders?customerId=${customerId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch customer orders' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: Order[] | PaginatedResponse<Order> = await response.json();
      setCustomerOrders(Array.isArray(data) ? data : data.data);
    } catch (err: any) {
      console.error("Failed to fetch customer orders:", err);
      setCustomerOrdersError(err.message || 'Could not load customer orders.');
      setCustomerOrders([]);
    } finally {
      setIsCustomerOrdersLoading(false);
    }
  }, []);


  useEffect(() => {
    if (isViewModalOpen && currentCustomer?.id) {
      fetchOrdersForCustomer(currentCustomer.id);
    }
  }, [isViewModalOpen, currentCustomer, fetchOrdersForCustomer]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setCurrentCustomer(prev => ({
        ...prev,
        address: { ... (prev.address || defaultAddress), [addressField]: value }
      }));
    } else {
      setCurrentCustomer(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer.name) {
      setModalError("Ім'я клієнта є обов'язковим.");
      return;
    }
    setModalError(null);
    setIsLoading(true);

    const customerDataToSubmit: Partial<Customer> = {
      name: currentCustomer.name,
      email: currentCustomer.email || '',
      phone: currentCustomer.phone || '',
      instagramHandle: currentCustomer.instagramHandle || '',
      viberNumber: currentCustomer.viberNumber || '',
      notes: currentCustomer.notes || '',
      address: currentCustomer.address || defaultAddress,
      joinDate: editingCustomer ? editingCustomer.joinDate : new Date().toISOString().split('T')[0],
    };

    try {
      let response;
      if (editingCustomer) {
        response = await authenticatedFetch(`${API_BASE_URL}/customers/${editingCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify(customerDataToSubmit),
        });
      } else {
        response = await authenticatedFetch(`${API_BASE_URL}/customers`, {
          method: 'POST',
          body: JSON.stringify(customerDataToSubmit),
        });
      }

      if (!response.ok) {
        let errorMessage = `Failed to ${editingCustomer ? 'update' : 'add'} customer. Status: ${response.status} ${response.statusText}`;
        try {
            const errData = await response.json();
            errorMessage = errData.message || errorMessage;
        } catch (e) { /* ignore json parse error */ }
        throw new Error(errorMessage);
      }
      fetchCustomers(currentPage); 
      closeModal();
    } catch (err: any) {
      console.error("Failed to save customer:", err);
      setModalError(err.message || `Could not ${editingCustomer ? 'update' : 'add'} customer. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setCurrentCustomer(initialCustomerState);
    setIsModalOpen(true);
    setModalError(null);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setCurrentCustomer({ ...customer, address: { ...(customer.address || defaultAddress) }});
    setIsModalOpen(true);
    setModalError(null);
  };

  const openViewModal = (customer: Customer) => {
    setCurrentCustomer(customer);
    setIsViewModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsViewModalOpen(false);
    setCurrentCustomer(initialCustomerState);
    setModalError(null);
    setCustomerOrders([]);
    setCustomerOrdersError(null);
    setExpandedOrderId(null);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити цього клієнта? Цю дію неможливо скасувати.')) {
      setIsLoading(true);
      setPageError(null);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/customers/${customerId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 204) {
          let errorMessage = `Failed to delete customer. Status: ${response.status} ${response.statusText}`;
          try {
              const errData = await response.json();
              errorMessage = errData.message || errorMessage;
          } catch (e) { /* ignore json parse error */ }
          throw new Error(errorMessage);
        }
        const newTotalCount = totalCount - 1;
        const newTotalPages = Math.ceil(newTotalCount / pageSize);
        const newCurrentPage = (currentPage > newTotalPages && newTotalPages > 0) ? newTotalPages : currentPage;
        setCurrentPage(newCurrentPage);
        fetchCustomers(newCurrentPage);
      } catch (err: any) {
        console.error("Failed to delete customer:", err);
        setPageError(err.message || 'Could not delete customer. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleToggleOrderDetails = (orderId: string) => {
    setExpandedOrderId(prevId => (prevId === orderId ? null : orderId));
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Керування клієнтами</h2>
        <button
            onClick={openAddModal}
            aria-label="Додати нового клієнта"
            className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
        >
            <PlusIcon className="w-5 h-5" />
            <span className="ml-2">Додати клієнта</span>
        </button>
      </div>

       <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row gap-4">
            <input
                type="search"
                aria-label="Пошук клієнтів"
                placeholder="Пошук за ім'ям, email, або телефоном..."
                className="flex-grow p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-slate-200"
                value={searchTerm}
                onChange={handleSearchChange}
            />
            <select 
                value={filter} 
                onChange={handleFilterChange} 
                className="p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 w-full md:w-auto bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-slate-200"
                aria-label="Фільтрувати клієнтів"
            >
                <option value="default">За замовчуванням</option>
                <option value="vip">VIP Клієнти (за витратами)</option>
                <option value="inactive">Неактивні клієнти</option>
            </select>
        </div>
      </div>

      {pageError && <div role="alert" className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg">{pageError}</div>}
      
      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
         {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Ім'я</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Телефон</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Дата реєстрації</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
              {isLoading ? (
                 <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Завантаження...</td></tr>
              ) : customers.length > 0 ? (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-rose-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-100 break-words">{customer.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 break-words">{customer.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{customer.phone || 'Н/Д'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{new Date(customer.joinDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                      <button onClick={() => openViewModal(customer)} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors p-2 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10" title="Переглянути деталі клієнта" aria-label={`Переглянути деталі для ${customer.name}`}><EyeIcon className="w-5 h-5"/></button>
                      <button onClick={() => openEditModal(customer)} className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-2 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Редагувати клієнта" aria-label={`Редагувати ${customer.name}`}><PencilIcon className="w-5 h-5"/></button>
                      <button onClick={() => handleDeleteCustomer(customer.id)} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10" title="Видалити клієнта" aria-label={`Видалити ${customer.name}`}><TrashIcon className="w-5 h-5"/></button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {!pageError && (totalCount === 0 && searchTerm === '' ? "Клієнтів ще немає. Натисніть 'Додати клієнта', щоб почати." : "Клієнтів, що відповідають вашому пошуку, не знайдено.")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
            {isLoading ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Завантаження...</div>
            ) : customers.length > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {customers.map(customer => (
                        <li key={customer.id} className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-slate-800 dark:text-slate-100 pr-4">{customer.name}</p>
                                <div className="flex-shrink-0 flex items-center space-x-1">
                                    <button onClick={() => openViewModal(customer)} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-2 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10"><EyeIcon className="w-5 h-5"/></button>
                                    <button onClick={() => openEditModal(customer)} className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10"><PencilIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleDeleteCustomer(customer.id)} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                                <p><span className="font-medium">Email:</span> {customer.email}</p>
                                <p><span className="font-medium">Телефон:</span> {customer.phone || 'Н/Д'}</p>
                                <p><span className="font-medium">Дата реєстрації:</span> {new Date(customer.joinDate).toLocaleDateString()}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                 <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {!pageError && (totalCount === 0 && searchTerm === '' ? "Клієнтів ще немає." : "Клієнтів не знайдено.")}
                </div>
            )}
        </div>

        {totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isLoading={isLoading}
          />
        )}
      </div>

      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="customer-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-md md:max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200 dark:border-slate-700">
              <h3 id="customer-modal-title" className="text-xl font-semibold text-slate-800 dark:text-slate-100">{editingCustomer ? 'Редагувати клієнта' : 'Додати нового клієнта'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg text-sm">{modalError}</div>}
            <form onSubmit={handleSubmitCustomer} className="space-y-4 overflow-y-auto pr-2 flex-grow">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Повне ім'я <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="name" id="name" value={currentCustomer.name || ''} onChange={handleInputChange} required aria-required="true" className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" name="email" id="email" value={currentCustomer.email || ''} onChange={handleInputChange} className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Телефон</label>
                  <input type="tel" name="phone" id="phone" value={currentCustomer.phone || ''} onChange={handleInputChange} className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="instagramHandle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Нік Instagram</label>
                  <input type="text" name="instagramHandle" id="instagramHandle" value={currentCustomer.instagramHandle || ''} onChange={handleInputChange} className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="@username" />
                </div>
                <div>
                  <label htmlFor="viberNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Номер Viber</label>
                  <input type="tel" name="viberNumber" id="viberNumber" value={currentCustomer.viberNumber || ''} onChange={handleInputChange} className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="+380..." />
                </div>
              </div>
              <fieldset className="border p-4 rounded-lg border-slate-300 dark:border-slate-600">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-300 px-1">Адреса</legend>
                <div className="space-y-3 mt-2">
                    <div>
                        <label htmlFor="address.street" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Вулиця</label>
                        <input type="text" name="address.street" id="address.street" value={currentCustomer.address?.street || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="address.city" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Місто</label>
                            <input type="text" name="address.city" id="address.city" value={currentCustomer.address?.city || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                        </div>
                        <div>
                            <label htmlFor="address.state" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Штат / Область</label>
                            <input type="text" name="address.state" id="address.state" value={currentCustomer.address?.state || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                        </div>
                        <div>
                            <label htmlFor="address.zip" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Поштовий індекс</label>
                            <input type="text" name="address.zip" id="address.zip" value={currentCustomer.address?.zip || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="address.country" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Країна</label>
                        <input type="text" name="address.country" id="address.country" value={currentCustomer.address?.country || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                    </div>
                </div>
              </fieldset>
              
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Нотатки</label>
                <textarea name="notes" id="notes" value={currentCustomer.notes || ''} onChange={handleInputChange} rows={3} className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
              </div>

              <div className="flex flex-col sm:flex-row justify-end pt-6 space-y-2 sm:space-y-0 sm:space-x-3 border-t border-slate-200 dark:border-slate-700">
                <button 
                    type="button" 
                    onClick={closeModal} 
                    className="w-full sm:w-auto bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
                    disabled={isLoading}
                >Скасувати</button>
                <button 
                    type="submit" 
                    className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    disabled={isLoading}
                >
                  {isLoading ? (editingCustomer ? 'Збереження...' : 'Додавання...') : (editingCustomer ? 'Зберегти зміни' : 'Додати клієнта')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isViewModalOpen && currentCustomer && currentCustomer.id && (
         <div role="dialog" aria-modal="true" aria-labelledby="view-customer-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 id="view-customer-modal-title" className="text-xl font-semibold text-slate-800 dark:text-slate-100">{currentCustomer.name}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
            </div>
            <div className="space-y-4 text-sm overflow-y-auto pr-2 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><span className="font-semibold text-slate-500 dark:text-slate-400 w-28 inline-block">ID Клієнта:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{currentCustomer.id}</span></p>
                    <p><span className="font-semibold text-slate-500 dark:text-slate-400 w-28 inline-block">Email:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{currentCustomer.email}</span></p>
                    <p><span className="font-semibold text-slate-500 dark:text-slate-400 w-28 inline-block">Телефон:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{currentCustomer.phone || 'Н/Д'}</span></p>
                    <p><span className="font-semibold text-slate-500 dark:text-slate-400 w-28 inline-block">Instagram:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{currentCustomer.instagramHandle || 'Н/Д'}</span></p>
                    <p><span className="font-semibold text-slate-500 dark:text-slate-400 w-28 inline-block">Viber:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{currentCustomer.viberNumber || 'Н/Д'}</span></p>
                    <p><span className="font-semibold text-slate-500 dark:text-slate-400 w-28 inline-block">Дата реєстрації:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{currentCustomer.joinDate ? new Date(currentCustomer.joinDate).toLocaleDateString() : 'N/A'}</span></p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">Адреса:</p>
                    {currentCustomer.address && (currentCustomer.address.street || currentCustomer.address.city) ? (
                      <div className='font-medium text-slate-800 dark:text-slate-200'>
                        <p>{currentCustomer.address.street}</p>
                        <p>{currentCustomer.address.city}{currentCustomer.address.state && `, ${currentCustomer.address.state}`} {currentCustomer.address.zip}</p>
                        <p>{currentCustomer.address.country}</p>
                      </div>
                    ) : <p className="text-slate-500 dark:text-slate-400 italic">Адреса не вказана</p>}
                  </div>
              </div>
              {currentCustomer.notes && (
                <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-500 dark:text-slate-400 mb-1">Нотатки:</h4>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md">{currentCustomer.notes}</p>
                </div>
              )}
               <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-500 dark:text-slate-400 mb-2">Історія замовлень ({customerOrders.length})</h4>
                  {isCustomerOrdersLoading ? <p className="text-slate-500 dark:text-slate-400">Завантаження замовлень...</p> 
                   : customerOrdersError ? <p className="text-red-600 dark:text-red-400">{customerOrdersError}</p>
                   : customerOrders.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                          {customerOrders.map(order => (
                            <li key={order.id}>
                               <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer" onClick={() => handleToggleOrderDetails(order.id)}>
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <p className="font-semibold text-slate-800 dark:text-slate-200">Замовлення #{order.id.substring(0, 8)}</p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(order.date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex-1 text-center"><StatusPill status={order.status} /></div>
                                    <div className="flex-1 text-right font-bold text-slate-800 dark:text-slate-200">₴{order.totalAmount.toFixed(2)}</div>
                                    <ChevronDownIcon className={`w-5 h-5 text-slate-400 ml-2 transition-transform ${expandedOrderId === order.id ? 'rotate-180' : ''}`} />
                                  </div>
                               </div>
                               {expandedOrderId === order.id && (
                                   <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600">
                                      <h5 className="font-semibold text-slate-600 dark:text-slate-300 text-xs mb-1">Товари:</h5>
                                      <ul className="text-xs space-y-0.5 text-slate-600 dark:text-slate-400">
                                        {order.items.map(item => (
                                          <li key={item.id} className="flex justify-between">
                                            <span>{item.productName} x {item.quantity}</span>
                                            <span>₴{(item.price * item.quantity).toFixed(2)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                   </div>
                               )}
                            </li>
                          ))}
                        </ul>
                      </div>
                   ) : <p className="text-slate-500 dark:text-slate-400 italic">У цього клієнта ще немає замовлень.</p>
                  }
               </div>
            </div>
             <div className="flex justify-end pt-6 space-x-3 border-t border-slate-200 dark:border-slate-700">
                <button 
                    type="button" 
                    onClick={closeModal} 
                    className="w-full sm:w-auto bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
                >Закрити</button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple ChevronDownIcon for the collapsible orders
const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);


export default CustomersPage;