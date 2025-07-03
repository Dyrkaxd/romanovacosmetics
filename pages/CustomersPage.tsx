
import React, { useState, useEffect, useCallback } from 'react';
import { Customer, Order } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';

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
    Ordered: 'bg-amber-50 text-amber-600 ring-amber-600/20',
    Shipped: 'bg-blue-50 text-blue-600 ring-blue-600/20',
    Received: 'bg-green-50 text-green-600 ring-green-600/20',
    Calculation: 'bg-indigo-50 text-indigo-600 ring-indigo-600/20',
    AwaitingApproval: 'bg-purple-50 text-purple-600 ring-purple-600/20',
    PaidByClient: 'bg-teal-50 text-teal-600 ring-teal-600/20',
    WrittenOff: 'bg-red-50 text-red-600 ring-red-600/20',
    ReadyForPickup: 'bg-lime-50 text-lime-600 ring-lime-600/20',
  };
  return (
    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ring-1 ring-inset ${styles[status]}`}>
      {orderStatusTranslations[status] || status}
    </span>
  );
};


const CustomersPage: React.FC = () => {
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
    address: defaultAddress 
  };
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>(initialCustomerState);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isCustomerOrdersLoading, setIsCustomerOrdersLoading] = useState(false);
  const [customerOrdersError, setCustomerOrdersError] = useState<string | null>(null);


  const API_BASE_URL = '/api';

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/customers`);
      if (!response.ok) {
        let errorMessage = `Failed to fetch customers. Status: ${response.status} ${response.statusText}`;
        try {
            const errData = await response.json();
            errorMessage = errData.message || errorMessage;
        } catch (e) { /* ignore json parse error */ }
        throw new Error(errorMessage);
      }
      let data: Customer[] = await response.json();
      setCustomers(data);
    } catch (err: any) {
      console.error("Failed to fetch customers:", err);
      setPageError(err.message || 'Could not load customers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOrdersForCustomer = useCallback(async (customerId: string) => {
    if (!customerId) return;
    setIsCustomerOrdersLoading(true);
    setCustomerOrdersError(null);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/orders?customerId=${customerId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch customer orders' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: Order[] = await response.json();
      setCustomerOrders(data);
    } catch (err: any) {
      console.error("Failed to fetch customer orders:", err);
      setCustomerOrdersError(err.message || 'Could not load customer orders.');
      setCustomerOrders([]);
    } finally {
      setIsCustomerOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (isViewModalOpen && currentCustomer?.id) {
      fetchOrdersForCustomer(currentCustomer.id);
    }
  }, [isViewModalOpen, currentCustomer, fetchOrdersForCustomer]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      fetchCustomers(); 
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
        fetchCustomers();
      } catch (err: any) {
        console.error("Failed to delete customer:", err);
        setPageError(err.message || 'Could not delete customer. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.phone && customer.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Клієнти</h2>
        <button
          onClick={openAddModal}
          aria-label="Додати нового клієнта"
          className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="ml-2">Додати клієнта</span>
        </button>
      </div>

      <input
        type="search"
        aria-label="Пошук клієнтів"
        placeholder="Пошук за ім'ям, email, або телефоном..."
        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {pageError && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{pageError}</div>}
      {isLoading && customers.length === 0 && <div className="text-center p-4">Завантаження клієнтів...</div>}


      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Ім'я</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden sm:table-cell">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden md:table-cell">Телефон</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden md:table-cell">Дата реєстрації</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!isLoading && filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-rose-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{customer.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden sm:table-cell">{customer.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden md:table-cell">{customer.phone || 'Н/Д'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden md:table-cell">{new Date(customer.joinDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                    <button onClick={() => openViewModal(customer)} className="text-slate-500 hover:text-sky-600 transition-colors p-2 rounded-md hover:bg-sky-50" title="Переглянути деталі клієнта" aria-label={`Переглянути деталі для ${customer.name}`}><EyeIcon className="w-5 h-5"/></button>
                    <button onClick={() => openEditModal(customer)} className="text-slate-500 hover:text-rose-600 transition-colors p-2 rounded-md hover:bg-rose-50" title="Редагувати клієнта" aria-label={`Редагувати ${customer.name}`}><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleDeleteCustomer(customer.id)} className="text-slate-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50" title="Видалити клієнта" aria-label={`Видалити ${customer.name}`}><TrashIcon className="w-5 h-5"/></button>
                  </td>
                </tr>
              ))}
              {isLoading && (
                 <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження...</td></tr>
              )}
              {!isLoading && customers.length === 0 && !pageError && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Клієнтів ще немає. Натисніть 'Додати клієнта', щоб почати.</td></tr>
              )}
              {!isLoading && customers.length > 0 && filteredCustomers.length === 0 && (
                 <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Клієнтів, що відповідають вашому пошуку, не знайдено.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="customer-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md md:max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200">
              <h3 id="customer-modal-title" className="text-xl font-semibold text-slate-800">{editingCustomer ? 'Редагувати клієнта' : 'Додати нового клієнта'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{modalError}</div>}
            <form onSubmit={handleSubmitCustomer} className="space-y-4 overflow-y-auto pr-2 flex-grow">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Повне ім'я <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="name" id="name" value={currentCustomer.name || ''} onChange={handleInputChange} required aria-required="true" className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" name="email" id="email" value={currentCustomer.email || ''} onChange={handleInputChange} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                  <input type="tel" name="phone" id="phone" value={currentCustomer.phone || ''} onChange={handleInputChange} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="instagramHandle" className="block text-sm font-medium text-slate-700 mb-1">Нік Instagram</label>
                  <input type="text" name="instagramHandle" id="instagramHandle" value={currentCustomer.instagramHandle || ''} onChange={handleInputChange} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="@username" />
                </div>
                <div>
                  <label htmlFor="viberNumber" className="block text-sm font-medium text-slate-700 mb-1">Номер Viber</label>
                  <input type="tel" name="viberNumber" id="viberNumber" value={currentCustomer.viberNumber || ''} onChange={handleInputChange} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="+380..." />
                </div>
              </div>
              <fieldset className="border p-4 rounded-lg">
                <legend className="text-sm font-medium text-slate-700 px-1">Адреса</legend>
                <div className="space-y-3 mt-2">
                    <div>
                        <label htmlFor="address.street" className="block text-xs font-medium text-slate-600">Вулиця</label>
                        <input type="text" name="address.street" id="address.street" value={currentCustomer.address?.street || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="address.city" className="block text-xs font-medium text-slate-600">Місто</label>
                            <input type="text" name="address.city" id="address.city" value={currentCustomer.address?.city || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                        </div>
                        <div>
                            <label htmlFor="address.state" className="block text-xs font-medium text-slate-600">Штат / Область</label>
                            <input type="text" name="address.state" id="address.state" value={currentCustomer.address?.state || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                        </div>
                        <div>
                            <label htmlFor="address.zip" className="block text-xs font-medium text-slate-600">Поштовий індекс</label>
                            <input type="text" name="address.zip" id="address.zip" value={currentCustomer.address?.zip || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="address.country" className="block text-xs font-medium text-slate-600">Країна</label>
                        <input type="text" name="address.country" id="address.country" value={currentCustomer.address?.country || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                    </div>
                </div>
              </fieldset>
              
              <div className="flex flex-col sm:flex-row justify-end pt-6 space-y-2 sm:space-y-0 sm:space-x-3 border-t border-slate-200">
                <button 
                    type="button" 
                    onClick={closeModal} 
                    className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
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
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <h3 id="view-customer-modal-title" className="text-xl font-semibold text-slate-800">{currentCustomer.name}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
            </div>
            <div className="space-y-4 text-sm overflow-y-auto pr-2 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><span className="font-semibold text-slate-500 w-28 inline-block">ID Клієнта:</span> <span className="font-medium text-slate-800">{currentCustomer.id}</span></p>
                    <p><span className="font-semibold text-slate-500 w-28 inline-block">Email:</span> <span className="font-medium text-slate-800">{currentCustomer.email}</span></p>
                    <p><span className="font-semibold text-slate-500 w-28 inline-block">Телефон:</span> <span className="font-medium text-slate-800">{currentCustomer.phone || 'Н/Д'}</span></p>
                    <p><span className="font-semibold text-slate-500 w-28 inline-block">Нік Instagram:</span> <span className="font-medium text-slate-800">{currentCustomer.instagramHandle || 'Н/Д'}</span></p>
                    <p><span className="font-semibold text-slate-500 w-28 inline-block">Номер Viber:</span> <span className="font-medium text-slate-800">{currentCustomer.viberNumber || 'Н/Д'}</span></p>
                    <p><span className="font-semibold text-slate-500 w-28 inline-block">Дата реєстрації:</span> <span className="font-medium text-slate-800">{currentCustomer.joinDate ? new Date(currentCustomer.joinDate).toLocaleDateString() : 'N/A'}</span></p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 mb-1">Адреса:</p>
                    {currentCustomer.address && (currentCustomer.address.street || currentCustomer.address.city) ? (
                      <div className='font-medium text-slate-800'>
                        <p>{currentCustomer.address.street}</p>
                        <p>{currentCustomer.address.city}{currentCustomer.address.state && `, ${currentCustomer.address.state}`} {currentCustomer.address.zip}</p>
                        <p>{currentCustomer.address.country}</p>
                      </div>
                    ) : <p className="text-slate-800">Інформація про адресу відсутня.</p>}
                  </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-lg font-semibold text-slate-800 mb-2">Історія замовлень</h4>
                {isCustomerOrdersLoading ? (
                    <div className="text-center p-4 text-slate-500">Завантаження замовлень...</div>
                ) : customerOrdersError ? (
                    <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{customerOrdersError}</div>
                ) : customerOrders.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-semibold text-slate-500 tracking-wider">ID Замовлення</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-semibold text-slate-500 tracking-wider">Дата</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-semibold text-slate-500 tracking-wider">Статус</th>
                                    <th scope="col" className="px-4 py-2 text-right text-xs font-semibold text-slate-500 tracking-wider">Сума</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {customerOrders.map(order => (
                                    <tr key={order.id}>
                                        <td className="px-4 py-2 whitespace-nowrap font-semibold text-rose-600">#{order.id.substring(0, 6)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{new Date(order.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 whitespace-nowrap"><StatusPill status={order.status} /></td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right font-medium">₴{order.totalAmount.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center p-4 bg-slate-50 rounded-lg text-slate-500">У цього клієнта ще немає замовлень.</div>
                )}
              </div>
            </div>
            <div className="mt-6 pt-6 text-right border-t border-slate-200">
                <button onClick={closeModal} className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">
                  Закрити
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
