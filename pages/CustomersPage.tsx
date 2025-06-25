
import React, { useState, useEffect, useCallback } from 'react';
import { Customer } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/Icons';

// const CUSTOMERS_STORAGE_KEY = 'ecomDashCustomers'; // No longer used

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

  const API_BASE_URL = '/api';

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/customers`);
      if (!response.ok) {
        let errorMessage = `Failed to fetch customers. Status: ${response.status} ${response.statusText}`;
        let responseBodyText = '';
        try {
            responseBodyText = await response.text();
            const errData = JSON.parse(responseBodyText);
            errorMessage = errData.message || `Server error: ${response.status} ${response.statusText}`;
        } catch (jsonError) {
            errorMessage = `Server responded with non-JSON (${response.status} ${response.statusText}): ${responseBodyText.substring(0, 200)}...`;
            console.error("Full non-JSON error response from server (fetchCustomers):", responseBodyText);
        }
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

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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
    if (!currentCustomer.name || !currentCustomer.email) {
      setModalError("Ім'я та email клієнта є обов'язковими.");
      return;
    }
    setModalError(null);
    setIsLoading(true);

    const customerDataToSubmit: Partial<Customer> = {
      name: currentCustomer.name,
      email: currentCustomer.email,
      phone: currentCustomer.phone || '',
      instagramHandle: currentCustomer.instagramHandle || '',
      viberNumber: currentCustomer.viberNumber || '',
      address: currentCustomer.address || defaultAddress,
      joinDate: editingCustomer ? editingCustomer.joinDate : new Date().toISOString().split('T')[0],
    };

    try {
      let response;
      if (editingCustomer) {
        response = await fetch(`${API_BASE_URL}/customers/${editingCustomer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerDataToSubmit),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerDataToSubmit),
        });
      }

      if (!response.ok) {
        let errorMessage = `Failed to ${editingCustomer ? 'update' : 'add'} customer. Status: ${response.status} ${response.statusText}`;
        let responseBodyText = '';
        try {
            responseBodyText = await response.text();
            const errData = JSON.parse(responseBodyText);
            errorMessage = errData.message || `Server error: ${response.status} ${response.statusText}`;
        } catch (jsonError) {
            errorMessage = `Server responded with non-JSON (${response.status} ${response.statusText}): ${responseBodyText.substring(0, 200)}...`;
            console.error("Full non-JSON error response from server (handleSubmitCustomer):", responseBodyText);
        }
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
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити цього клієнта? Цю дію неможливо скасувати.')) {
      setIsLoading(true);
      setPageError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, { method: 'DELETE' });
        if (!response.ok) {
          let errorMessage = `Failed to delete customer. Status: ${response.status} ${response.statusText}`;
          let responseBodyText = '';
          try {
              responseBodyText = await response.text();
              const errData = JSON.parse(responseBodyText);
              errorMessage = errData.message || `Server error: ${response.status} ${response.statusText}`;
          } catch (jsonError) {
              errorMessage = `Server responded with non-JSON (${response.status} ${response.statusText}): ${responseBodyText.substring(0, 200)}...`;
              console.error("Full non-JSON error response from server (handleDeleteCustomer):", responseBodyText);
          }
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
    (customer.phone && customer.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.instagramHandle && customer.instagramHandle.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.viberNumber && customer.viberNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-xl font-semibold text-slate-700">Список клієнтів</h2>
        <button
          onClick={openAddModal}
          aria-label="Додати нового клієнта"
          className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors w-full sm:w-auto justify-center"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="hidden sm:inline ml-2">Додати нового клієнта</span>
          <span className="sm:hidden ml-2">Додати</span>
        </button>
      </div>

      <input
        type="search"
        aria-label="Пошук клієнтів"
        placeholder="Пошук клієнтів..."
        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {pageError && <div role="alert" className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{pageError}</div>}
      {isLoading && customers.length === 0 && <div className="text-center p-4">Завантаження клієнтів...</div>}


      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Ім'я</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider hidden md:table-cell">Телефон</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider hidden md:table-cell">Дата реєстрації</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!isLoading && filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{customer.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 hidden sm:table-cell">{customer.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 hidden md:table-cell">{customer.phone || 'Н/Д'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 hidden md:table-cell">{new Date(customer.joinDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onClick={() => openViewModal(customer)} className="text-sky-600 hover:text-sky-800 transition-colors p-1" title="Переглянути деталі клієнта" aria-label={`Переглянути деталі для ${customer.name}`}><EyeIcon className="w-5 h-5 inline"/></button>
                    <button onClick={() => openEditModal(customer)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1" title="Редагувати клієнта" aria-label={`Редагувати ${customer.name}`}><PencilIcon className="w-5 h-5 inline"/></button>
                    <button onClick={() => handleDeleteCustomer(customer.id)} className="text-red-600 hover:text-red-800 transition-colors p-1" title="Видалити клієнта" aria-label={`Видалити ${customer.name}`}><TrashIcon className="w-5 h-5 inline"/></button>
                  </td>
                </tr>
              ))}
              {isLoading && (
                 <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження...</td></tr>
              )}
              {!isLoading && customers.length === 0 && !pageError && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Клієнтів ще немає. Натисніть 'Додати нового клієнта', щоб почати.</td></tr>
              )}
              {!isLoading && customers.length > 0 && filteredCustomers.length === 0 && (
                 <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Клієнтів, що відповідають вашому пошуку, не знайдено.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="customer-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 id="customer-modal-title" className="text-lg font-semibold text-slate-800">{editingCustomer ? 'Редагувати клієнта' : 'Додати нового клієнта'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
            {modalError && <div role="alert" className="mb-3 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{modalError}</div>}
            <form onSubmit={handleSubmitCustomer} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">Повне ім'я <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="name" id="name" value={currentCustomer.name || ''} onChange={handleInputChange} required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email <span aria-hidden="true" className="text-red-500">*</span></label>
                  <input type="email" name="email" id="email" value={currentCustomer.email || ''} onChange={handleInputChange} required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Телефон</label>
                  <input type="tel" name="phone" id="phone" value={currentCustomer.phone || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="instagramHandle" className="block text-sm font-medium text-slate-700">Нік Instagram</label>
                  <input type="text" name="instagramHandle" id="instagramHandle" value={currentCustomer.instagramHandle || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" placeholder="@username" />
                </div>
                <div>
                  <label htmlFor="viberNumber" className="block text-sm font-medium text-slate-700">Номер Viber</label>
                  <input type="tel" name="viberNumber" id="viberNumber" value={currentCustomer.viberNumber || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" placeholder="+380..." />
                </div>
              </div>
              <fieldset className="border p-4 rounded-md">
                <legend className="text-sm font-medium text-slate-700 px-1">Адреса</legend>
                <div className="space-y-3 mt-2">
                    <div>
                        <label htmlFor="address.street" className="block text-xs font-medium text-slate-600">Вулиця</label>
                        <input type="text" name="address.street" id="address.street" value={currentCustomer.address?.street || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="address.city" className="block text-xs font-medium text-slate-600">Місто</label>
                            <input type="text" name="address.city" id="address.city" value={currentCustomer.address?.city || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                        </div>
                        <div>
                            <label htmlFor="address.state" className="block text-xs font-medium text-slate-600">Штат / Область</label>
                            <input type="text" name="address.state" id="address.state" value={currentCustomer.address?.state || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                        </div>
                        <div>
                            <label htmlFor="address.zip" className="block text-xs font-medium text-slate-600">Поштовий індекс</label>
                            <input type="text" name="address.zip" id="address.zip" value={currentCustomer.address?.zip || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="address.country" className="block text-xs font-medium text-slate-600">Країна</label>
                        <input type="text" name="address.country" id="address.country" value={currentCustomer.address?.country || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                    </div>
                </div>
              </fieldset>
              
              <div className="flex flex-col sm:flex-row justify-end pt-2 space-y-2 sm:space-y-0 sm:space-x-3">
                <button 
                    type="button" 
                    onClick={closeModal} 
                    className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
                    disabled={isLoading}
                >Скасувати</button>
                <button 
                    type="submit" 
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50"
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
         <div role="dialog" aria-modal="true" aria-labelledby="view-customer-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 id="view-customer-modal-title" className="text-lg font-semibold text-slate-800">{currentCustomer.name}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold text-slate-700">ID Клієнта:</span> <span className="text-slate-800">{currentCustomer.id}</span></p>
              <p><span className="font-semibold text-slate-700">Email:</span> <span className="text-slate-800">{currentCustomer.email}</span></p>
              <p><span className="font-semibold text-slate-700">Телефон:</span> <span className="text-slate-800">{currentCustomer.phone || 'Н/Д'}</span></p>
              <p><span className="font-semibold text-slate-700">Нік Instagram:</span> <span className="text-slate-800">{currentCustomer.instagramHandle || 'Н/Д'}</span></p>
              <p><span className="font-semibold text-slate-700">Номер Viber:</span> <span className="text-slate-800">{currentCustomer.viberNumber || 'Н/Д'}</span></p>
              <p><span className="font-semibold text-slate-700">Дата реєстрації:</span> <span className="text-slate-800">{currentCustomer.joinDate ? new Date(currentCustomer.joinDate).toLocaleDateString() : 'N/A'}</span></p>
              <div className="mt-2 pt-2 border-t">
                <p className="font-semibold text-slate-700 mb-1">Адреса:</p>
                {currentCustomer.address && (currentCustomer.address.street || currentCustomer.address.city) ? (
                  <>
                    <p className="text-slate-800">{currentCustomer.address.street}</p>
                    <p className="text-slate-800">{currentCustomer.address.city}{currentCustomer.address.state && `, ${currentCustomer.address.state}`} {currentCustomer.address.zip}</p>
                    <p className="text-slate-800">{currentCustomer.address.country}</p>
                  </>
                ) : <p className="text-slate-800">Інформація про адресу відсутня.</p>}
              </div>
            </div>
            <div className="mt-6 text-right">
                <button onClick={closeModal} className="bg-slate-500 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors">
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