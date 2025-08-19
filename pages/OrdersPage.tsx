import React, { useState, useEffect, useCallback, useMemo, useRef, FC, SVGProps } from 'react';
import { Order, OrderItem, Customer, Product, ManagedUser, PaginatedResponse } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, FilterIcon, DownloadIcon, ChevronDownIcon, ShareIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';
import { useAuth } from '../AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

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

const toYYYYMMDD = (date: Date) => date.toISOString().split('T')[0];
const API_BASE_URL = '/api';

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
  const location = useLocation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [activeOrderData, setActiveOrderData] = useState<Partial<Order>>({});
  const initialNewOrderItem: OrderItem = { productId: '', productName: '', quantity: 1, price: 0, discount: 0 };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allOrderManagers, setAllOrderManagers] = useState<{ email: string; name: string }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
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

  // State for searchable customer dropdown in modal
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // State for searchable product dropdowns in modal
  const [openProductDropdown, setOpenProductDropdown] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [isProductSearching, setIsProductSearching] = useState(false);
  const debouncedProductSearch = useDebounce(productSearchTerm, 300);
  const productDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  const isAnyFilterActive = useMemo(() => {
    return (
        searchTerm !== '' ||
        filterStatus !== 'All' ||
        filterCustomerId !== 'All' ||
        (isAdmin && filterManagerEmail !== 'All') ||
        filterStartDate !== '' ||
        filterEndDate !== ''
    );
  }, [searchTerm, filterStatus, filterCustomerId, filterManagerEmail, filterStartDate, filterEndDate, isAdmin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openProductDropdown !== null && productDropdownRefs.current[openProductDropdown] && !productDropdownRefs.current[openProductDropdown]!.contains(event.target as Node)) {
        setOpenProductDropdown(null);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openProductDropdown, isCustomerDropdownOpen]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [customersRes, managersRes, adminsRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/customers?pageSize=1000`),
        isAdmin ? authenticatedFetch(`${API_BASE_URL}/managedUsers`) : Promise.resolve(null),
        isAdmin ? authenticatedFetch(`${API_BASE_URL}/admins`) : Promise.resolve(null),
      ]);

      const customersData: PaginatedResponse<Customer> = await customersRes.json();
      setCustomers(customersData.data.sort((a,b) => a.name.localeCompare(b.name)));
      
      if(isAdmin && managersRes && adminsRes) {
        const managers: ManagedUser[] = await managersRes.json();
        const admins = await adminsRes.json();
        const allManagers = [
          ...admins.map((a: any) => ({ email: a.email, name: a.name || a.email })),
          ...managers.map(m => ({ email: m.email, name: m.name }))
        ];
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

  useEffect(() => {
    if (debouncedProductSearch.length < 2) {
        setProductSearchResults([]); return;
    }
    const searchProducts = async () => {
        setIsProductSearching(true);
        try {
            const res = await authenticatedFetch(`${API_BASE_URL}/products?search=${encodeURIComponent(debouncedProductSearch)}`);
            if (!res.ok) throw new Error('Помилка пошуку товарів');
            const data: PaginatedResponse<Product> = await res.json();
            setProductSearchResults(data.data);
        } catch (err) {
            console.error(err); setProductSearchResults([]);
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

  const debouncedSearchTerm = useDebounce(searchTerm, 400);

  useEffect(() => {
    fetchOrders(currentPage);
  }, [fetchOrders, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterStatus, filterCustomerId, filterManagerEmail, filterStartDate, filterEndDate]);
  
    const openViewModal = useCallback((order: Order) => setViewOrder(order), []);

    useEffect(() => {
        const orderIdToOpen = location.state?.openOrderId;

        const fetchAndOpen = async (id: string) => {
            try {
                const res = await authenticatedFetch(`/api/orders/${id}`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || 'Замовлення не знайдено');
                }
                const { order } = await res.json();
                if (order) {
                    openViewModal(order);
                } else {
                    setPageError(`Не вдалося знайти замовлення з ID: ${id}`);
                }
            } catch (err: any) {
                setPageError(`Помилка завантаження замовлення: ${err.message}`);
            } finally {
                navigate(location.pathname, { replace: true, state: {} });
            }
        };

        if (orderIdToOpen) {
            const orderInList = orders.find(o => o.id === orderIdToOpen);
            if (orderInList) {
                openViewModal(orderInList);
                navigate(location.pathname, { replace: true, state: {} });
            } else if (!isLoading) {
                fetchAndOpen(orderIdToOpen);
            }
        }
    }, [location.state, orders, isLoading, navigate, openViewModal]);

  const handlePageChange = (page: number) => setCurrentPage(page);
  
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchTerm(''); setFilterStatus('All'); setFilterCustomerId('All');
    setFilterManagerEmail('All'); setFilterStartDate(''); setFilterEndDate('');
  };

  const closeModal = () => {
    setModalMode(null); setViewOrder(null); setActiveOrderData({});
    setModalError(null);
    setCustomerSearchTerm('');
  };

  const openAddModal = () => {
    setActiveOrderData({
      date: toYYYYMMDD(new Date()), status: 'Ordered',
      items: [initialNewOrderItem], totalAmount: 0,
      managedByUserEmail: user?.email,
    });
    setCustomerSearchTerm('');
    setModalMode('add');
  };

  const openEditModal = (order: Order) => {
    setActiveOrderData({ ...order, date: toYYYYMMDD(new Date(order.date)) });
    setCustomerSearchTerm(order.customerName);
    setModalMode('edit');
  };

  const handleEditFromView = (orderToEdit: Order) => {
    setViewOrder(null); // Close the view modal
    openEditModal(orderToEdit); // Open the edit modal with the correct data
  };


  const handleDeleteOrder = async (orderId: string) => {
      if (window.confirm('Ви впевнені, що хочете видалити це замовлення?')) {
          setIsLoading(true);
          try {
              const res = await authenticatedFetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
              if (res.status !== 204) throw new Error((await res.json()).message || 'Не вдалося видалити замовлення.');
              setSuccessMessage('Замовлення успішно видалено.');
              const newTotal = totalCount - 1;
              const newTotalPages = Math.ceil(newTotal / pageSize);
              if (currentPage > newTotalPages) setCurrentPage(Math.max(1, newTotalPages));
              else fetchOrders(currentPage);
          } catch (err: any) {
              setPageError(err.message);
          } finally {
              setIsLoading(false);
          }
      }
  };

  const handleCopyInvoiceLink = (orderId: string) => {
    const url = `${window.location.origin}/#/invoice/${orderId}`;
    navigator.clipboard.writeText(url).then(() => {
        setSuccessMessage('Посилання на рахунок скопійовано!');
    }, (err) => {
        setPageError('Не вдалося скопіювати посилання.');
        console.error('Copy failed', err);
    });
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const updatedItems = [...(activeOrderData.items || [])];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    const totalAmount = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 - (item.discount || 0) / 100)), 0);
    setActiveOrderData({ ...activeOrderData, items: updatedItems, totalAmount });
  };

  const handleAddItem = () => {
    const items = [...(activeOrderData.items || []), initialNewOrderItem];
    setActiveOrderData({ ...activeOrderData, items });
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = (activeOrderData.items || []).filter((_, i) => i !== index);
    const totalAmount = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 - (item.discount || 0) / 100)), 0);
    setActiveOrderData({ ...activeOrderData, items: updatedItems, totalAmount });
  };

  const handleSelectProduct = (itemIndex: number, product: Product) => {
    const updatedItems = [...(activeOrderData.items || [])];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      productId: product.id,
      productName: product.name,
      price: product.retailPrice * product.exchangeRate,
      salonPriceUsd: product.salonPrice,
      exchangeRate: product.exchangeRate,
    };
    const totalAmount = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 - (item.discount || 0) / 100)), 0);
    setActiveOrderData({ ...activeOrderData, items: updatedItems, totalAmount });
    setOpenProductDropdown(null);
    setProductSearchTerm('');
    setProductSearchResults([]);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrderData.customerId) { setModalError('Будь ласка, оберіть клієнта.'); return; }
    if (!activeOrderData.items || activeOrderData.items.length === 0 || activeOrderData.items.some(i => !i.productId)) { setModalError('Замовлення повинно містити хоча б один товар.'); return; }
    setIsSubmitting(true); setModalError(null);
    try {
        const method = modalMode === 'edit' ? 'PUT' : 'POST';
        const url = modalMode === 'edit' ? `${API_BASE_URL}/orders/${activeOrderData.id}` : `${API_BASE_URL}/orders`;
        const response = await authenticatedFetch(url, { method, body: JSON.stringify(activeOrderData) });
        if (!response.ok) throw new Error((await response.json()).message || 'Не вдалося зберегти замовлення.');
        setSuccessMessage(`Замовлення успішно ${modalMode === 'edit' ? 'оновлено' : 'створено'}.`);
        closeModal();
        fetchOrders(currentPage);
    } catch (err: any) {
        setModalError(err.message);
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
    );
  }, [customers, customerSearchTerm]);

  const handleSelectCustomer = (customer: Customer) => {
    setActiveOrderData(prev => ({ ...prev, customerId: customer.id, customerName: customer.name }));
    setCustomerSearchTerm(customer.name);
    setIsCustomerDropdownOpen(false);
  };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3">
                    {successMessage && <div className="p-2 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 rounded-lg text-sm transition-opacity">{successMessage}</div>}
                </div>
                <button onClick={openAddModal} className="w-full sm:w-auto flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm">
                    <PlusIcon className="w-5 h-5 mr-2" /> Додати замовлення
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row gap-4">
                    <input type="search" placeholder="Пошук за ім'ям клієнта..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
                    <button onClick={() => setShowFilters(!showFilters)} className="flex-shrink-0 flex items-center justify-center gap-2 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                        <FilterIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" /> <span className="font-medium text-slate-700 dark:text-slate-200">Фільтри</span>
                    </button>
                </div>
                {showFilters && (
                    <div className="mt-4 pt-4 border-t dark:border-slate-700">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="flex-grow min-w-[180px]">
                                <label htmlFor="filterStatus" className="text-xs font-medium text-slate-500 dark:text-slate-400">Статус</label>
                                <select id="filterStatus" value={filterStatus} onChange={e => setFilterStatus(e.target.value as Order['status'] | 'All')} className="mt-1 w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg">
                                    <option value="All">Всі статуси</option>
                                    {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                                </select>
                            </div>

                            <div className="flex-grow min-w-[180px]">
                                <label htmlFor="filterCustomer" className="text-xs font-medium text-slate-500 dark:text-slate-400">Клієнт</label>
                                <select id="filterCustomer" value={filterCustomerId} onChange={e => setFilterCustomerId(e.target.value)} className="mt-1 w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg">
                                    <option value="All">Всі клієнти</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            {isAdmin && (
                                <div className="flex-grow min-w-[180px]">
                                    <label htmlFor="filterManager" className="text-xs font-medium text-slate-500 dark:text-slate-400">Менеджер</label>
                                    <select id="filterManager" value={filterManagerEmail} onChange={e => setFilterManagerEmail(e.target.value)} className="mt-1 w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg">
                                        <option value="All">Всі менеджери</option>
                                        {allOrderManagers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="flex-grow min-w-[280px]">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Дата</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
                                    <span className="text-slate-500 dark:text-slate-400">-</span>
                                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
                                </div>
                            </div>

                            {isAnyFilterActive && (
                                <button 
                                    onClick={resetFilters} 
                                    className="flex items-center gap-1.5 h-[42px] text-sm font-medium text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-2 rounded-lg border border-red-300 dark:border-red-500/30 hover:border-red-400 dark:hover:border-red-500/50 transition-colors"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                    Скинути
                                </button>
                             )}
                        </div>
                    </div>
                )}
            </div>

            {pageError && <div role="alert" className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20 rounded-lg">{pageError}</div>}
            
            <div className="bg-white dark:bg-slate-800 shadow-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">ID Замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Клієнт</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Сума</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {isLoading ? <tr><td colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400">Завантаження замовлень...</td></tr>
                            : orders.length > 0 ? orders.map(order => (
                                <tr key={order.id} className="hover:bg-rose-50/50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-semibold text-rose-600 dark:text-rose-400">#{order.id.substring(0, 8)}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-100">{order.customerName}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{new Date(order.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4"><StatusPill status={order.status} /></td>
                                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">₴{order.totalAmount.toFixed(2)}</td>
                                    <td className="px-6 py-4 space-x-1">
                                        <button onClick={() => openViewModal(order)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10" title="Переглянути"><EyeIcon className="w-5 h-5"/></button>
                                        <button onClick={() => navigate(`/invoice/${order.id}`)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-gray-400 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500/10" title="Рахунок-фактура"><DocumentTextIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleCopyInvoiceLink(order.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10" title="Копіювати посилання на рахунок"><ShareIcon className="w-5 h-5"/></button>
                                        <button onClick={() => openEditModal(order)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Редагувати"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10" title="Видалити"><TrashIcon className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            )) : <tr><td colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400">Замовлень, що відповідають фільтрам, не знайдено.</td></tr>}
                        </tbody>
                    </table>
                </div>
                
                <div className="md:hidden">
                  {isLoading ? <div className="p-6 text-center text-slate-500 dark:text-slate-400">Завантаження...</div>
                  : orders.length > 0 ? (
                      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                          {orders.map(order => (
                              <li key={order.id} className="p-4 space-y-3">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <p className="font-semibold text-rose-600 dark:text-rose-400">#{order.id.substring(0,8)}</p>
                                          <p className="font-bold text-slate-800 dark:text-slate-100">{order.customerName}</p>
                                      </div>
                                      <StatusPill status={order.status} />
                                  </div>
                                  <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(order.date).toLocaleDateString()}</p>
                                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">₴{order.totalAmount.toFixed(2)}</p>
                                    </div>
                                    <div className="flex space-x-1">
                                      <button onClick={() => openViewModal(order)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-md"><EyeIcon className="w-5 h-5"/></button>
                                      <button onClick={() => navigate(`/invoice/${order.id}`)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded-md"><DocumentTextIcon className="w-5 h-5"/></button>
                                      <button onClick={() => handleCopyInvoiceLink(order.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md"><ShareIcon className="w-5 h-5"/></button>
                                      <button onClick={() => openEditModal(order)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md"><PencilIcon className="w-5 h-5"/></button>
                                      <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                  </div>
                              </li>
                          ))}
                      </ul>
                  ) : <div className="py-10 text-center text-slate-500 dark:text-slate-400">Замовлень не знайдено.</div>}
                </div>
                
                {totalCount > 0 && <Pagination currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} isLoading={isLoading} />}
            </div>
            
            {modalMode && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{modalMode === 'edit' ? 'Редагувати замовлення' : 'Створити нове замовлення'}</h3>
                            <button onClick={closeModal} disabled={isSubmitting}><XMarkIcon className="w-6 h-6 text-slate-400 dark:hover:text-slate-300"/></button>
                        </div>
                        {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg text-sm">{modalError}</div>}
                        
                        <form onSubmit={handleSubmitOrder} className="flex-grow overflow-y-auto pr-2 space-y-4">
                            <div className={`grid grid-cols-1 md:grid-cols-2 ${modalMode === 'add' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
                                <div className="relative" ref={customerDropdownRef}>
                                    <label htmlFor="customerSearch" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Клієнт</label>
                                    <input
                                        type="text"
                                        id="customerSearch"
                                        value={customerSearchTerm}
                                        onChange={e => { setCustomerSearchTerm(e.target.value); if (!isCustomerDropdownOpen) setIsCustomerDropdownOpen(true); }}
                                        onFocus={() => setIsCustomerDropdownOpen(true)}
                                        placeholder="Почніть вводити ім'я..."
                                        autoComplete="off"
                                        className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"
                                        required
                                    />
                                    {isCustomerDropdownOpen && (
                                        <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-900 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto border dark:border-slate-700">
                                            {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                                                <div key={c.id} onClick={() => handleSelectCustomer(c)} className="p-3 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer text-sm">
                                                    <p className="font-semibold dark:text-slate-100">{c.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.email}</p>
                                                </div>
                                            )) : <div className="p-3 text-sm text-slate-500 dark:text-slate-400">Клієнтів не знайдено.</div>}
                                        </div>
                                    )}
                                </div>
                                {modalMode === 'edit' && (
                                    <div>
                                        <label htmlFor="date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Дата</label>
                                        <input type="date" id="date" value={activeOrderData.date} onChange={e => setActiveOrderData(prev => ({...prev, date: e.target.value}))} required className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Статус</label>
                                    <select id="status" value={activeOrderData.status} onChange={e => setActiveOrderData(prev => ({...prev, status: e.target.value as Order['status']}))} required className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg">
                                        {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                                    </select>
                                </div>
                                
                                <div>
                                    <label htmlFor="managedByUserEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Менеджер</label>
                                    <select 
                                        id="managedByUserEmail" 
                                        value={activeOrderData.managedByUserEmail || ''} 
                                        onChange={e => setActiveOrderData(prev => ({...prev, managedByUserEmail: e.target.value}))} 
                                        className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg disabled:bg-slate-100 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                                        disabled={!isAdmin}
                                    >
                                        {isAdmin ? (
                                          <>
                                            <option value="">Не призначено</option>
                                            {allOrderManagers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                                          </>
                                        ) : (
                                          <option value={user?.email}>{user?.name || user?.email}</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="pt-4 mt-4 border-t dark:border-slate-700">
                                <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Товари в замовленні</h4>
                                <div className="space-y-3">
                                    {(activeOrderData.items || []).map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50/70 dark:bg-slate-700/50 rounded-lg">
                                            <div className="col-span-12 md:col-span-5 relative" ref={el => { if(el) productDropdownRefs.current[index] = el; }}>
                                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Назва товару</label>
                                                <input
                                                    type="text"
                                                    value={openProductDropdown === index ? productSearchTerm : item.productName}
                                                    onChange={e => {
                                                        if (openProductDropdown !== index) setOpenProductDropdown(index);
                                                        setProductSearchTerm(e.target.value);
                                                    }}
                                                    onFocus={() => {
                                                        setOpenProductDropdown(index);
                                                        setProductSearchTerm(item.productName);
                                                    }}
                                                    placeholder="Почніть вводити назву..."
                                                    className="w-full mt-1 p-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 rounded-md"
                                                    required
                                                />
                                                {openProductDropdown === index && (
                                                    <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-900 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto border dark:border-slate-700">
                                                        {isProductSearching ? <div className="p-3 text-sm text-slate-500 dark:text-slate-400">Пошук...</div>
                                                        : productSearchResults.length > 0 ? productSearchResults.map(p => (
                                                            <div key={p.id} onClick={() => handleSelectProduct(index, p)} className="p-3 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer text-sm">
                                                                <p className="font-semibold dark:text-slate-100">{p.name}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">Залишок: {p.quantity}</p>
                                                            </div>
                                                        )) : <div className="p-3 text-sm text-slate-500 dark:text-slate-400">Товарів не знайдено.</div>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="col-span-3 md:col-span-1">
                                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">К-сть</label>
                                                <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} min="1" required className="w-full mt-1 p-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 rounded-md"/>
                                            </div>
                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Ціна (₴)</label>
                                                <input type="number" value={item.price} onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)} min="0" step="0.01" required className="w-full mt-1 p-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 rounded-md disabled:bg-slate-100 dark:disabled:bg-slate-600" disabled={!isAdmin}/>
                                            </div>
                                            <div className="col-span-3 md:col-span-2">
                                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Знижка (%)</label>
                                                <input type="number" value={item.discount} onChange={e => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} min="0" max="100" className="w-full mt-1 p-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 rounded-md"/>
                                            </div>
                                            <div className="col-span-2 md:col-span-2">
                                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Всього</label>
                                                <p className="w-full mt-1 p-2 font-semibold text-slate-800 dark:text-slate-100">₴{(item.quantity * item.price * (1 - (item.discount || 0) / 100)).toFixed(2)}</p>
                                            </div>
                                             <button type="button" onClick={() => handleRemoveItem(index)} className="col-span-12 md:col-span-1 self-center md:self-end text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10">
                                                <TrashIcon className="w-5 h-5 mx-auto"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={handleAddItem} className="mt-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300">+ Додати товар</button>
                            </div>
                            
                             <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Нотатки до замовлення</label>
                                <textarea id="notes" value={activeOrderData.notes || ''} onChange={e => setActiveOrderData(prev => ({ ...prev, notes: e.target.value }))} rows={2} className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
                            </div>
                            
                            <div className="flex justify-between items-center pt-6 border-t dark:border-slate-700">
                                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">Загальна сума: ₴{activeOrderData.totalAmount?.toFixed(2) || '0.00'}</p>
                                <div className="flex space-x-3">
                                    <button type="button" onClick={closeModal} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2 px-4 rounded-lg" disabled={isSubmitting}>Скасувати</button>
                                    <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white py-2 px-4 rounded-lg" disabled={isSubmitting}>{isSubmitting ? 'Збереження...' : 'Зберегти замовлення'}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewOrder && (
                 <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                         <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Замовлення #{viewOrder.id.substring(0,8)}</h3>
                            <button onClick={closeModal}><XMarkIcon className="w-6 h-6 text-slate-400 dark:hover:text-slate-300"/></button>
                        </div>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Клієнт</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{viewOrder.customerName}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Дата</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{new Date(viewOrder.date).toLocaleDateString()}</p>
                                </div>
                                 <div>
                                    <p className="text-slate-500 dark:text-slate-400">Статус</p>
                                    <StatusPill status={viewOrder.status} />
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Менеджер</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{allOrderManagers.find(m => m.email === viewOrder.managedByUserEmail)?.name || viewOrder.managedByUserEmail || 'Не призначено'}</p>
                                </div>
                            </div>
                            <div className="pt-4 mt-4 border-t dark:border-slate-700">
                                <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Товари</h4>
                                <ul className="divide-y dark:divide-slate-700">
                                    {viewOrder.items.map(item => (
                                        <li key={item.id} className="py-2 flex justify-between items-center">
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-slate-200">{item.productName}</p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">{item.quantity} шт. × ₴{item.price.toFixed(2)}{item.discount > 0 ? ` (-${item.discount}%)` : ''}</p>
                                            </div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">₴{(item.quantity * item.price * (1 - (item.discount || 0)/100)).toFixed(2)}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {viewOrder.notes && (
                                <div className="pt-4 mt-4 border-t dark:border-slate-700">
                                    <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Нотатки</h4>
                                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{viewOrder.notes}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center pt-6 border-t dark:border-slate-700">
                            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">Всього: ₴{viewOrder.totalAmount.toFixed(2)}</p>
                            <div className="flex space-x-3">
                                <button type="button" onClick={closeModal} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">Закрити</button>
                                <button 
                                    type="button" 
                                    onClick={() => handleEditFromView(viewOrder)} 
                                    className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
                                >
                                    <PencilIcon className="w-4 h-4 mr-2" />
                                    Редагувати
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;