







import React, { useState, useEffect, useCallback, useMemo, useRef, FC, SVGProps } from 'react';
import { Order, OrderItem, Customer, Product, ManagedUser, PaginatedResponse, NovaPoshtaDepartment } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, FilterIcon, DownloadIcon, ChevronDownIcon, ShareIcon, EllipsisVerticalIcon, TruckIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    NPWidget: any; 
  }
}

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

const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];
const API_BASE_URL = '/api';

// Debounce hook to delay API calls while user is typing
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};


const OrdersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'ttn' | null>(null);
  const [activeOrderData, setActiveOrderData] = useState<Partial<Order>>({});
  const initialNewOrderItem: OrderItem = { productId: '', productName: '', quantity: 1, price: 0, discount: 0 };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allOrderManagers, setAllOrderManagers] = useState<{ email: string; name: string }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Filtering and Pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'All'>('All');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('All');
  const [filterManagerEmail, setFilterManagerEmail] = useState<string>('All');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Reworked product fetching states for order modal
  const [openProductDropdown, setOpenProductDropdown] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [isProductSearching, setIsProductSearching] = useState(false);
  const debouncedProductSearch = useDebounce(productSearchTerm, 300);
  const productDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  // State for actions dropdown
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // State for Nova Poshta TTN Modal
  const [activeTtnOrder, setActiveTtnOrder] = useState<Order | null>(null);
  const [npDepartment, setNpDepartment] = useState<NovaPoshtaDepartment | null>(null);
  const [packageDetails, setPackageDetails] = useState({
      weight: "0.5",
      length: "20",
      width: "15",
      height: "10",
      description: "Косметичні засоби"
  });
  const [isCodEnabled, setIsCodEnabled] = useState(false);
  const [npWidgetError, setNpWidgetError] = useState<string | null>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openProductDropdown !== null && productDropdownRefs.current[openProductDropdown] && !productDropdownRefs.current[openProductDropdown]!.contains(event.target as Node)) {
        setOpenProductDropdown(null);
      }
      if (openActionMenu && actionMenuRefs.current[openActionMenu] && !actionMenuRefs.current[openActionMenu]!.contains(event.target as Node)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openProductDropdown, openActionMenu]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [customersRes, managersRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/customers?pageSize=1000`), // Fetch all customers for dropdown
        isAdmin ? authenticatedFetch(`${API_BASE_URL}/managedUsers`) : Promise.resolve(null),
        isAdmin ? authenticatedFetch(`${API_BASE_URL}/admins`) : Promise.resolve(null),
      ]);

      const customersData: PaginatedResponse<Customer> = await customersRes.json();
      setCustomers(customersData.data.sort((a,b) => a.name.localeCompare(b.name)));
      
      if(isAdmin && managersRes) {
        const managers: ManagedUser[] = await managersRes.json();
        const adminsRes = await (await Promise.all([isAdmin ? authenticatedFetch(`${API_BASE_URL}/admins`) : Promise.resolve(null)]))[0];
        const admins = await adminsRes!.json();

        const allManagers = [
          ...admins.map((a: any) => ({ email: a.email, name: a.email })),
          ...managers.map(m => ({ email: m.email, name: m.name }))
        ];
        // Deduplicate
        const uniqueManagers = Array.from(new Map(allManagers.map(item => [item.email, item])).values());
        setAllOrderManagers(uniqueManagers.sort((a,b) => a.name.localeCompare(b.name)));
      }

    } catch (err: any) {
      setPageError("Не вдалося завантажити допоміжні дані (клієнти, менеджери). " + err.message);
    }
  }, [isAdmin]);

  const fetchOrders = useCallback(async (page = 1) => {
    setIsLoading(true);
    setPageError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: searchTerm,
        status: filterStatus,
        customerId: filterCustomerId,
        managerEmail: filterManagerEmail,
        startDate: filterStartDate,
        endDate: filterEndDate
      });
      const res = await authenticatedFetch(`${API_BASE_URL}/orders?${params.toString()}`);
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to fetch orders.');
      const data: PaginatedResponse<Order> = await res.json();
      setOrders(data.data);
      setTotalCount(data.totalCount);
      setCurrentPage(data.currentPage);
    } catch (err: any) {
      setPageError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, searchTerm, filterStatus, filterCustomerId, filterManagerEmail, filterStartDate, filterEndDate]);

  // Effect for searching products on-demand
  useEffect(() => {
    const searchProducts = async () => {
        if (debouncedProductSearch.length < 2) {
            setProductSearchResults([]);
            return;
        }
        setIsProductSearching(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/products?search=${encodeURIComponent(debouncedProductSearch)}`);
            if (!res.ok) throw new Error('Помилка пошуку товарів');
            // Backend returns a flat list for search, not a paginated response for this UI element
            const data: PaginatedResponse<Product> = await res.json();
            setProductSearchResults(data.data);
        } catch (err) {
            console.error(err);
            setProductSearchResults([]);
        } finally {
            setIsProductSearching(false);
        }
    };
    if (openProductDropdown !== null) {
        searchProducts();
    }
  }, [debouncedProductSearch, openProductDropdown]);


  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchOrders(currentPage);
  }, [fetchOrders, currentPage]);

  const handlePageChange = (page: number) => setCurrentPage(page);
  
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders(1);
  };

  const resetFilters = () => {
    setSearchTerm(''); setFilterStatus('All'); setFilterCustomerId('All');
    setFilterManagerEmail('All'); setFilterStartDate(''); setFilterEndDate('');
    setShowFilters(false);
    setCurrentPage(1);
  };

  // Modal and Form Handlers
  const closeModal = () => {
    setModalMode(null);
    setViewOrder(null);
    setActiveOrderData({});
    setModalError(null);
    setActiveTtnOrder(null);
    setNpDepartment(null);
    setNpWidgetError(null);
  };

  const openAddModal = () => {
    setActiveOrderData({
      date: toYYYYMMDD(new Date()),
      status: 'Ordered',
      items: [initialNewOrderItem],
      totalAmount: 0,
      managedByUserEmail: user?.email,
    });
    setModalMode('add');
  };

  const openEditModal = (order: Order) => {
    setActiveOrderData({ ...order, date: toYYYYMMDD(new Date(order.date)) });
    setModalMode('edit');
  };

  const openViewModal = (order: Order) => {
    setViewOrder(order);
  };

  const openTtnModal = (order: Order) => {
    const customer = customers.find(c => c.id === order.customerId);
    if (!customer?.phone) {
        setPageError("Неможливо створити ТТН: у клієнта не вказано номер телефону.");
        return;
    }
    setActiveTtnOrder(order);
    setNpDepartment(null);
    setIsCodEnabled(false);
    setModalMode('ttn');
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити це замовлення? Цю дію неможливо скасувати.')) {
      setIsLoading(true);
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
        if (res.status !== 204) throw new Error((await res.json()).message || 'Failed to delete order.');
        setSuccessMessage('Замовлення успішно видалено.');
        fetchOrders(currentPage);
      } catch (err: any) {
        setPageError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Form field handlers
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setActiveOrderData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const items = [...(activeOrderData.items || [])];
    items[index] = { ...items[index], [field]: value };
    recalculateTotal(items);
  };
  
  const handleProductSelect = (index: number, product: Product) => {
    const items = [...(activeOrderData.items || [])];
    const itemToUpdate = { ...items[index] };
    itemToUpdate.productId = product.id;
    itemToUpdate.productName = product.name;
    itemToUpdate.price = product.retailPrice;
    itemToUpdate.salonPriceUsd = product.salonPrice;
    itemToUpdate.exchangeRate = product.exchangeRate;
    items[index] = itemToUpdate;
    recalculateTotal(items);
  };


  const handleAddItem = () => {
    const items = [...(activeOrderData.items || []), initialNewOrderItem];
    setActiveOrderData(prev => ({ ...prev, items }));
  };

  const handleRemoveItem = (index: number) => {
    const items = [...(activeOrderData.items || [])];
    items.splice(index, 1);
    recalculateTotal(items);
  };

  const recalculateTotal = (items: OrderItem[]) => {
    const totalAmount = items.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        const discountAmount = itemTotal * ((item.discount || 0) / 100);
        return sum + (itemTotal - discountAmount);
    }, 0);
    setActiveOrderData(prev => ({ ...prev, items, totalAmount }));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!activeOrderData.customerId || !activeOrderData.items || activeOrderData.items.length === 0) {
      setModalError("Будь ласка, виберіть клієнта та додайте хоча б один товар."); return;
    }
    
    setIsSubmitting(true);
    try {
        const method = modalMode === 'edit' ? 'PUT' : 'POST';
        const url = modalMode === 'edit' ? `${API_BASE_URL}/orders/${activeOrderData.id}` : `${API_BASE_URL}/orders`;
        
        const res = await authenticatedFetch(url, {
            method,
            body: JSON.stringify(activeOrderData),
        });

        if (!res.ok) throw new Error((await res.json()).message || 'Не вдалося зберегти замовлення.');

        setSuccessMessage(`Замовлення успішно ${modalMode === 'edit' ? 'оновлено' : 'створено'}.`);
        closeModal();
        fetchOrders(modalMode === 'add' ? 1 : currentPage); // Go to first page on add
    } catch (err: any) {
        setModalError(err.message);
    } finally {
        setIsSubmitting(false);
    }
  };
    
    const openNpWidget = () => {
        setNpWidgetError(null);
        if (typeof window.NPWidget === 'undefined') {
            setNpWidgetError('Не вдалося завантажити віджет "Нової Пошти". Перевірте, чи не блокує його ваш браузер, та оновіть сторінку.');
            return;
        }

        const widget = new window.NPWidget({
            apiKey: '', // API key is optional as per documentation
            onSelect: (data: any) => {
                 const department: NovaPoshtaDepartment = {
                    ref: data.ref,
                    name: data.description,
                    settlementName: data.city_name,
                    departmentNumber: data.number,
                    cityRef: data.city_ref,
                };
                setNpDepartment(department);
            },
            closeOnSelect: true,
        });
        widget.open();
    };

    const handleCreateTtn = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError(null);
        if (!activeTtnOrder || !npDepartment) {
            setModalError('Будь ласка, виберіть відділення "Нової Пошти".');
            return;
        }

        const customer = customers.find(c => c.id === activeTtnOrder.customerId);
        if (!customer) {
            setModalError('Не вдалося знайти дані клієнта.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                orderId: activeTtnOrder.id,
                recipient: {
                    name: customer.name,
                    phone: customer.phone.replace(/[^0-9]/g, ''),
                },
                recipientCityRef: npDepartment.cityRef,
                recipientAddressRef: npDepartment.ref,
                weight: packageDetails.weight,
                volumeGeneral: (parseFloat(packageDetails.length) * parseFloat(packageDetails.width) * parseFloat(packageDetails.height)) / 1000000,
                description: packageDetails.description,
                cost: activeTtnOrder.totalAmount,
                isCodEnabled: isCodEnabled,
            };
            
            const res = await authenticatedFetch(`${API_BASE_URL}/novaPoshta`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).message);

            setSuccessMessage(`ТТН успішно створено. Статус замовлення #${activeTtnOrder.id.substring(0,8)} змінено на "Відправлено".`);
            closeModal();
            fetchOrders(currentPage);
        } catch (err: any) {
            setModalError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Замовлення</h2>
        <button onClick={openAddModal} className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">
          <PlusIcon className="w-5 h-5 mr-2" /> Додати замовлення
        </button>
      </div>

      {successMessage && <div role="alert" className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">{successMessage}</div>}
      {pageError && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{pageError}</div>}
      
      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="search"
            placeholder="Пошук за ID замовлення або іменем клієнта..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          />
          <button onClick={handleSearch} className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors">
            Пошук
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
            <FilterIcon className="w-5 h-5"/> Фільтри
          </button>
        </div>
        {showFilters && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-200 pt-4">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="p-2.5 border border-slate-300 rounded-lg w-full">
                <option value="All">Всі статуси</option>
                {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
              </select>
              <select value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)} className="p-2.5 border border-slate-300 rounded-lg w-full">
                <option value="All">Всі клієнти</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {isAdmin && (
                  <select value={filterManagerEmail} onChange={(e) => setFilterManagerEmail(e.target.value)} className="p-2.5 border border-slate-300 rounded-lg w-full">
                      <option value="All">Всі менеджери</option>
                      {allOrderManagers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                  </select>
              )}
              <div className="flex items-center gap-2">
                  <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="p-2.5 border border-slate-300 rounded-lg w-full"/>
                  <span className="text-slate-500">-</span>
                  <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="p-2.5 border border-slate-300 rounded-lg w-full"/>
              </div>
              <div className="flex items-center gap-2 lg:col-start-3">
                 <button onClick={handleSearch} className="w-full px-4 py-2 bg-rose-500 text-white rounded-lg font-semibold hover:bg-rose-600">Застосувати</button>
                 <button onClick={resetFilters} className="w-full px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-semibold hover:bg-slate-50">Скинути</button>
              </div>
           </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">ID Замовлення</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Клієнт</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden md:table-cell">Дата</th>
                {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden lg:table-cell">Менеджер</th>}
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Сума</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Статус</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Дії</th>
              </tr>
            </thead>
             <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                 <tr><td colSpan={isAdmin ? 7:6} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження замовлень...</td></tr>
              ) : orders.length > 0 ? (
                orders.map(order => (
                  <tr key={order.id} className="hover:bg-rose-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-rose-600">#{order.id.substring(0, 8)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{order.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden md:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden lg:table-cell">{allOrderManagers.find(m => m.email === order.managedByUserEmail)?.name || order.managedByUserEmail || 'N/A'}</td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">₴{order.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusPill status={order.status}/></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="relative" ref={el => { actionMenuRefs.current[order.id] = el; }}>
                            <button onClick={() => setOpenActionMenu(openActionMenu === order.id ? null : order.id)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                                <EllipsisVerticalIcon className="w-5 h-5"/>
                            </button>
                             {openActionMenu === order.id && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-10 ring-1 ring-black ring-opacity-5">
                                    <button onClick={() => {openViewModal(order); setOpenActionMenu(null);}} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><EyeIcon className="w-4 h-4 mr-2"/> Переглянути</button>
                                    <button onClick={() => {openEditModal(order); setOpenActionMenu(null);}} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><PencilIcon className="w-4 h-4 mr-2"/> Редагувати</button>
                                     <hr className="my-1"/>
                                    {order.novaPoshtaPrintUrl ? (
                                        <a href={order.novaPoshtaPrintUrl} target="_blank" rel="noopener noreferrer" className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><TruckIcon className="w-4 h-4 mr-2"/> Друкувати ТТН</a>
                                    ) : (
                                        <button onClick={() => {openTtnModal(order); setOpenActionMenu(null);}} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><TruckIcon className="w-4 h-4 mr-2"/> Створити ТТН</button>
                                    )}
                                    <a href={`/invoice/${order.id}`} target="_blank" rel="noopener noreferrer" className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><DocumentTextIcon className="w-4 h-4 mr-2"/> Рахунок-фактура</a>
                                    <a href={`/bill-of-lading/${order.id}`} target="_blank" rel="noopener noreferrer" className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><DocumentTextIcon className="w-4 h-4 mr-2"/> ТТН</a>
                                    <button onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/#/invoice/${order.id}`); setSuccessMessage('Посилання на рахунок скопійовано!'); setOpenActionMenu(null);}} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><ShareIcon className="w-4 h-4 mr-2"/> Поділитися рахунком</button>
                                    <hr className="my-1"/>
                                    <button onClick={() => {handleDeleteOrder(order.id); setOpenActionMenu(null);}} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"><TrashIcon className="w-4 h-4 mr-2"/> Видалити</button>
                                </div>
                            )}
                        </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={isAdmin ? 7:6} className="px-6 py-10 text-center text-sm text-slate-500">
                  {!pageError && (totalCount === 0 && searchTerm === '' ? "Замовлень ще немає. Натисніть 'Додати замовлення', щоб почати." : "Замовлень, що відповідають вашому пошуку, не знайдено.")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalCount > 0 && <Pagination currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} isLoading={isLoading} />}
      </div>
      
       {/* Add/Edit Modal */}
      {modalMode === 'add' || modalMode === 'edit' ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
            <form id="order-form-id" onSubmit={handleSubmitOrder}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-xl font-semibold">{modalMode === 'add' ? 'Створити нове замовлення' : 'Редагувати замовлення'}</h3>
                        <button type="button" onClick={closeModal}><XMarkIcon className="w-6 h-6"/></button>
                    </div>
                    {modalError && <div role="alert" className="m-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{modalError}</div>}
                    <div className="flex-grow overflow-y-auto">
                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Клієнт</label>
                                <select name="customerId" value={activeOrderData.customerId || ''} onChange={handleFormChange} required className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg">
                                    <option value="" disabled>Виберіть клієнта</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Дата</label>
                                <input type="date" name="date" value={activeOrderData.date || ''} onChange={handleFormChange} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Статус</label>
                                <select name="status" value={activeOrderData.status || 'Ordered'} onChange={handleFormChange} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg">
                                    {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                                </select>
                            </div>
                            {isAdmin && (
                              <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-slate-700">Менеджер</label>
                                <select name="managedByUserEmail" value={activeOrderData.managedByUserEmail || ''} onChange={handleFormChange} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg">
                                    <option value="" disabled>Призначити менеджера</option>
                                    {allOrderManagers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                                </select>
                              </div>
                            )}
                        </div>
                        <div className="px-4 pb-4">
                            <h4 className="text-lg font-semibold text-slate-800 mb-2">Товари в замовленні</h4>
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 border rounded-lg p-2 bg-slate-50">
                                {(activeOrderData.items || []).map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded shadow-sm">
                                        <div className="col-span-12 md:col-span-5 relative" ref={el => { productDropdownRefs.current[index] = el; }}>
                                            <input type="text" placeholder="Пошук товару..." 
                                                defaultValue={item.productName}
                                                onFocus={() => { setOpenProductDropdown(index); setProductSearchTerm(''); setProductSearchResults([]); }}
                                                onChange={e => setProductSearchTerm(e.target.value)}
                                                className="w-full p-2 border-slate-300 rounded-lg"/>
                                            {openProductDropdown === index && (
                                                <div className="absolute top-full left-0 w-full max-h-60 overflow-y-auto bg-white border shadow-lg z-20 rounded-b-lg">
                                                    {isProductSearching ? (
                                                        <div className="p-2 text-sm text-slate-500">Пошук...</div>
                                                    ) : productSearchResults.length > 0 ? (
                                                        productSearchResults.map(p => (
                                                            <div key={p.id} onClick={() => { handleProductSelect(index, p); setOpenProductDropdown(null); }} className="p-2 hover:bg-rose-100 cursor-pointer text-sm">
                                                                {p.name}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-2 text-sm text-slate-500">{debouncedProductSearch.length < 2 ? 'Введіть мінімум 2 символи' : 'Товар не знайдено'}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <input type="number" placeholder="К-сть" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))} min="1" className="col-span-4 md:col-span-2 p-2 border-slate-300 rounded-lg"/>
                                        <input type="number" placeholder="Ціна" value={item.price} onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value))} step="0.01" className="col-span-4 md:col-span-2 p-2 border-slate-300 rounded-lg"/>
                                        <input type="number" placeholder="Знижка %" value={item.discount} onChange={e => handleItemChange(index, 'discount', parseFloat(e.target.value))} step="0.01" className="col-span-4 md:col-span-2 p-2 border-slate-300 rounded-lg"/>
                                        <button type="button" onClick={() => handleRemoveItem(index)} className="col-span-12 md:col-span-1 text-red-500 hover:text-red-700 p-2 flex justify-center"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={handleAddItem} className="mt-3 text-sm font-semibold text-rose-600 hover:text-rose-800">+ Додати товар</button>
                        </div>
                        <div className="p-4">
                            <label className="block text-sm font-medium text-slate-700">Нотатки до замовлення</label>
                            <textarea name="notes" value={activeOrderData.notes || ''} onChange={handleFormChange} rows={3} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg"></textarea>
                        </div>
                    </div>
                     <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t bg-slate-50 rounded-b-xl">
                        <p className="font-semibold text-xl text-slate-800 mb-2 sm:mb-0">Всього: ₴{(activeOrderData.totalAmount || 0).toFixed(2)}</p>
                        <div className="flex gap-3">
                            <button type="button" onClick={closeModal} className="bg-white border border-slate-300 py-2 px-4 rounded-lg">Скасувати</button>
                            <button type="submit" form="order-form-id" disabled={isSubmitting} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                                {isSubmitting ? 'Збереження...' : (modalMode === 'add' ? 'Створити замовлення' : 'Зберегти зміни')}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
      ) : null}

      {/* View Modal */}
      {viewOrder && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                 <div className="flex justify-between items-center p-4 border-b">
                     <h3 className="text-xl font-semibold">Деталі замовлення #{viewOrder.id.substring(0,8)}</h3>
                     <button onClick={closeModal}><XMarkIcon className="w-6 h-6"/></button>
                 </div>
                 <div className="p-4 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <p><strong className="text-slate-500">Клієнт:</strong> {viewOrder.customerName}</p>
                        <p><strong className="text-slate-500">Дата:</strong> {new Date(viewOrder.date).toLocaleDateString()}</p>
                        <p><strong className="text-slate-500">Статус:</strong> <StatusPill status={viewOrder.status} /></p>
                        {isAdmin && <p><strong className="text-slate-500">Менеджер:</strong> {allOrderManagers.find(m => m.email === viewOrder.managedByUserEmail)?.name || viewOrder.managedByUserEmail || 'N/A'}</p>}
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Товари:</h4>
                        <ul className="border rounded-lg divide-y">
                            {viewOrder.items.map(item => (
                                <li key={item.id} className="p-2 grid grid-cols-4 gap-2 text-sm">
                                    <span className="col-span-2">{item.productName}</span>
                                    <span className="text-center">{item.quantity} x ₴{item.price.toFixed(2)}</span>
                                    <span className="text-right font-medium">₴{(item.quantity * item.price * (1-(item.discount || 0)/100)).toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {viewOrder.notes && <div><strong className="text-slate-500">Нотатки:</strong><p className="p-2 bg-slate-50 rounded-md mt-1 text-sm">{viewOrder.notes}</p></div>}
                 </div>
                 <div className="flex justify-between items-center p-4 border-t bg-slate-50 rounded-b-xl">
                    <p className="font-semibold text-xl">Всього: ₴{viewOrder.totalAmount.toFixed(2)}</p>
                    <button onClick={closeModal} className="bg-slate-600 text-white py-2 px-4 rounded-lg">Закрити</button>
                 </div>
             </div>
        </div>
      )}

       {/* TTN Modal */}
      {modalMode === 'ttn' && activeTtnOrder && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
            <form onSubmit={handleCreateTtn}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-xl font-semibold">Створення ТТН для замовлення #{activeTtnOrder.id.substring(0,8)}</h3>
                        <button type="button" onClick={closeModal} disabled={isSubmitting}><XMarkIcon className="w-6 h-6"/></button>
                    </div>
                    {modalError && <div role="alert" className="m-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{modalError}</div>}
                    {npWidgetError && <div role="alert" className="m-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{npWidgetError}</div>}
                    <div className="p-4 space-y-4">
                        <div>
                            <p className="text-sm font-medium text-slate-700">Одержувач: <span className="font-bold text-slate-900">{activeTtnOrder.customerName}</span></p>
                        </div>
                        
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Відділення "Нова Пошта"</label>
                            <div className="flex items-center gap-4">
                                <div className="flex-grow p-3 border border-slate-300 rounded-lg bg-slate-50 min-h-[60px]">
                                    {npDepartment ? (
                                        <div>
                                            <p className="font-semibold text-slate-800">{npDepartment.name}</p>
                                            <p className="text-sm text-slate-500">{npDepartment.settlementName}</p>
                                        </div>
                                    ) : (
                                        <p className="text-slate-500">Відділення не вибрано</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={openNpWidget}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex-shrink-0"
                                >
                                    Обрати
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-sm font-medium text-slate-700">Вага, кг</label>
                                <input type="number" value={packageDetails.weight} onChange={e => setPackageDetails(p => ({...p, weight: e.target.value}))} required className="mt-1 block w-full p-2 border-slate-300 rounded-lg" step="0.01" min="0.01"/>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-sm font-medium text-slate-700">Довжина, см</label>
                                <input type="number" value={packageDetails.length} onChange={e => setPackageDetails(p => ({...p, length: e.target.value}))} required className="mt-1 block w-full p-2 border-slate-300 rounded-lg" min="1"/>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-sm font-medium text-slate-700">Ширина, см</label>
                                <input type="number" value={packageDetails.width} onChange={e => setPackageDetails(p => ({...p, width: e.target.value}))} required className="mt-1 block w-full p-2 border-slate-300 rounded-lg" min="1"/>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-sm font-medium text-slate-700">Висота, см</label>
                                <input type="number" value={packageDetails.height} onChange={e => setPackageDetails(p => ({...p, height: e.target.value}))} required className="mt-1 block w-full p-2 border-slate-300 rounded-lg" min="1"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Опис відправлення</label>
                            <input type="text" value={packageDetails.description} onChange={e => setPackageDetails(p => ({...p, description: e.target.value}))} required className="mt-1 block w-full p-2 border-slate-300 rounded-lg"/>
                        </div>
                         <div>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={isCodEnabled}
                                    onChange={(e) => setIsCodEnabled(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                                />
                                <span className="text-sm font-medium text-slate-700">Післяплата (накладений платіж)</span>
                            </label>
                            {isCodEnabled && (
                                <p className="text-xs text-slate-500 mt-1 ml-7">
                                    Сума до сплати одержувачем: ₴{activeTtnOrder.totalAmount.toFixed(2)}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 p-4 border-t bg-slate-50">
                        <button type="button" onClick={closeModal} className="bg-white border border-slate-300 py-2 px-4 rounded-lg" disabled={isSubmitting}>Скасувати</button>
                        <button type="submit" disabled={isSubmitting || !npDepartment} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isSubmitting ? 'Створення...' : 'Створити ТТН'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;