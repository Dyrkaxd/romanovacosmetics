import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/Icons';

const initialCustomersData: Customer[] = [
  { id: 'CUST001', name: 'Аліса Чудесенко', email: 'alice@example.com', phone: '555-0101', address: { street: '123 Fantasy Lane', city: 'Wonderland', state: 'CA', zip: '90210', country: 'USA' }, joinDate: '2023-01-15' },
  { id: 'CUST002', name: 'Богдан Будівельник', email: 'bob@example.com', phone: '555-0102', address: { street: '456 Construction Rd', city: 'Builderville', state: 'NY', zip: '10001', country: 'USA' }, joinDate: '2023-02-20' },
  { id: 'CUST003', name: 'Чарлі Браун', email: 'charlie@example.com', phone: '555-0103', address: { street: '789 Comic Strip', city: 'Toontown', state: 'IL', zip: '60606', country: 'USA' }, joinDate: '2023-03-10' },
];

const CUSTOMERS_STORAGE_KEY = 'ecomDashCustomers';

const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const storedCustomers = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (storedCustomers) {
      try {
        return JSON.parse(storedCustomers);
      } catch (error) {
        console.error("Помилка розбору клієнтів з localStorage:", error);
        return initialCustomersData; 
      }
    }
    return initialCustomersData;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>({});
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const defaultAddress = { street: '', city: '', state: '', zip: '', country: '' };

  useEffect(() => {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
  }, [customers]);


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

  const handleSubmitCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...editingCustomer, ...currentCustomer, address: { ...(editingCustomer.address), ...(currentCustomer.address || defaultAddress) } } as Customer : c));
    } else {
      const newCustomer: Customer = {
        id: `CUST${Date.now().toString().slice(-4)}`, 
        name: currentCustomer.name || 'Безіменний клієнт',
        email: currentCustomer.email || 'no-email@example.com',
        phone: currentCustomer.phone || '',
        address: { ...(defaultAddress), ...(currentCustomer.address || defaultAddress) },
        joinDate: new Date().toISOString().split('T')[0],
        ...currentCustomer, 
      };
      if (!newCustomer.name || !newCustomer.email) {
        alert("Ім'я та email клієнта є обов'язковими.");
        return;
      }
      setCustomers(prevCustomers => [newCustomer, ...prevCustomers]);
    }
    closeModal();
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setCurrentCustomer({ address: defaultAddress, name: '', email: '', phone: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setCurrentCustomer({ ...customer, address: { ...(customer.address || defaultAddress) }});
    setIsModalOpen(true);
  };

  const openViewModal = (customer: Customer) => {
    setCurrentCustomer(customer);
    setIsViewModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsViewModalOpen(false);
    setCurrentCustomer({ address: defaultAddress });
  };

  const handleDeleteCustomer = (customerId: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити цього клієнта? Цю дію неможливо скасувати.')) {
      setCustomers(customers.filter(c => c.id !== customerId));
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
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{customer.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 hidden sm:table-cell">{customer.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 hidden md:table-cell">{customer.phone || 'Н/Д'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 hidden md:table-cell">{customer.joinDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onClick={() => openViewModal(customer)} className="text-sky-600 hover:text-sky-800 transition-colors p-1" title="Переглянути деталі клієнта" aria-label={`Переглянути деталі для ${customer.name}`}><EyeIcon className="w-5 h-5 inline"/></button>
                    <button onClick={() => openEditModal(customer)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1" title="Редагувати клієнта" aria-label={`Редагувати ${customer.name}`}><PencilIcon className="w-5 h-5 inline"/></button>
                    <button onClick={() => handleDeleteCustomer(customer.id)} className="text-red-600 hover:text-red-800 transition-colors p-1" title="Видалити клієнта" aria-label={`Видалити ${customer.name}`}><TrashIcon className="w-5 h-5 inline"/></button>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    {customers.length === 0 ? "Клієнтів ще немає. Натисніть 'Додати нового клієнта', щоб почати." : "Клієнтів, що відповідають вашому пошуку, не знайдено."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="customer-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 id="customer-modal-title" className="text-lg font-semibold text-slate-800">{editingCustomer ? 'Редагувати клієнта' : 'Додати нового клієнта'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
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
                <button type="button" onClick={closeModal} className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors">Скасувати</button>
                <button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors">
                  {editingCustomer ? 'Зберегти зміни' : 'Додати клієнта'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Customer Modal */}
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
              <p><span className="font-semibold text-slate-700">Дата реєстрації:</span> <span className="text-slate-800">{currentCustomer.joinDate}</span></p>
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