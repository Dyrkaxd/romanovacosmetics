import React, { useState, useEffect, useCallback, useMemo, useRef, FC, SVGProps } from 'react';
import { Order, OrderItem, Customer, Product, ManagedUser, PaginatedResponse } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, FilterIcon, DownloadIcon, ChevronDownIcon, ShareIcon, EllipsisVerticalIcon, TruckIcon, MapPinIcon, ArrowPathIcon, LightBulbIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

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

  const [openProductDropdown, setOpenProductDropdown] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [isProductSearching, setIsProductSearching] = useState(false);
  const debouncedProductSearch = useDebounce(productSearchTerm, 300);
  const productDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Product[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
  

  const handlePageChange = (page: number) => setCurrentPage(page);
  
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchTerm(''); setFilterStatus('All'); setFilterCustomerId('All');
    setFilterManagerEmail('All'); setFilterStartDate(''); setFilterEndDate('');
    setShowFilters(false);
  };

  const closeModal = () => {
    setModalMode(null); setViewOrder(null); setActiveOrderData({});
    setModalError(null); setAiSuggestions([]); setShowAiSuggestions(false); setAiError(null);
  };

  const openAddModal = () => {
    setActiveOrderData({
      date: toYYYYMMDD(new Date()), status: 'Ordered',
      items: [initialNewOrderItem], totalAmount: 0,
      managedByUserEmail: user?.email,
    });
    setModalMode('add');
  };

  const openEditModal = (order: Order) => {
    setActiveOrderData({ ...order, date: toYYYYMMDD(new Date(order.date)) });
    setModalMode('edit');
  };

  const openViewModal = (order: Order) => setViewOrder(order);

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

  const handleGetAiSuggestions = async () => {
    if (!activeOrderData.items || activeOrderData.items.filter(i => i.productId).length === 0) {
      setAiError("Додайте хоча б один товар, щоб отримати поради.");
      return;
    }
    setIsAiLoading(true);
    setAiError(null);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/productSuggestions`, {
            method: 'POST',
            body: JSON.stringify({ items: activeOrderData.items.filter(i => i.productId) }),
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Не вдалося отримати поради від AI.');
        const suggestions: Product[] = await response.json();
        setAiSuggestions(suggestions);
        setShowAiSuggestions(true);
    } catch (err: any) {
        setAiError(err.message);
    } finally {
        setIsAiLoading(false);
    }
  };
  
  const handleAddSuggestionToOrder = (product: Product) => {
    const newItem: OrderItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.retailPrice * product.exchangeRate,
        discount: 0,
        salonPriceUsd: product.salonPrice,
        exchangeRate: product.exchangeRate,
    };
    const currentItems = activeOrderData.items || [];
    // Check if the last item is empty, if so replace it, otherwise add new
    if (currentItems.length > 0 && !currentItems[currentItems.length - 1].productId) {
        const updatedItems = [...currentItems];
        updatedItems[updatedItems.length - 1] = newItem;
        const totalAmount = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 - (item.discount || 0) / 100)), 0);
        setActiveOrderData({ ...activeOrderData, items: updatedItems, totalAmount });
    } else {
        const updatedItems = [...currentItems, newItem];
        const totalAmount = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 - (item.discount || 0) / 100)), 0);
        setActiveOrderData({ ...activeOrderData, items: updatedItems, totalAmount });
    }
    setAiSuggestions(prev => prev.filter(p => p.id !== product.id));
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


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3">
                    {successMessage && <div className="p-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm transition-opacity">{successMessage}</div>}
                </div>
                <button onClick={openAddModal} className="w-full sm:w-auto flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm">
                    <PlusIcon className="w-5 h-5 mr-2" /> Додати замовлення
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row gap-4">
                    <input type="search" placeholder="Пошук за ID, ім'ям клієнта..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow p-2.5 border border-slate-300 rounded-lg"/>
                    <button onClick={() => setShowFilters(!showFilters)} className="flex-shrink-0 flex items-center justify-center gap-2 p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50">
                        <FilterIcon className="w-5 h-5 text-slate-500" /> <span className="font-medium text-slate-700">Фільтри</span>
                    </button>
                </div>
                {showFilters && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Order['status'] | 'All')} className="p-2.5 border border-slate-300 rounded-lg">
                            <option value="All">Всі статуси</option>
                            {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                        </select>
                        <select value={filterCustomerId} onChange={e => setFilterCustomerId(e.target.value)} className="p-2.5 border border-slate-300 rounded-lg">
                            <option value="All">Всі клієнти</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {isAdmin && (
                             <select value={filterManagerEmail} onChange={e => setFilterManagerEmail(e.target.value)} className="p-2.5 border border-slate-300 rounded-lg">
                                <option value="All">Всі менеджери</option>
                                {allOrderManagers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                            </select>
                        )}
                        <div className="flex items-center gap-2">
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg"/>
                            <span className="text-slate-500">-</span>
                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg"/>
                        </div>
                         <button onClick={resetFilters} className="text-sm font-semibold text-rose-600 hover:text-rose-800">Скинути фільтри</button>
                    </div>
                )}
            </div>

            {pageError && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg">{pageError}</div>}
            
            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
                <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">ID Замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Клієнт</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Сума</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {isLoading ? <tr><td colSpan={6} className="text-center py-10 text-slate-500">Завантаження замовлень...</td></tr>
                            : orders.length > 0 ? orders.map(order => (
                                <tr key={order.id} className="hover:bg-rose-50/50">
                                    <td className="px-6 py-4 font-semibold text-rose-600">#{order.id.substring(0, 8)}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">{order.customerName}</td>
                                    <td className="px-6 py-4 text-slate-600">{new Date(order.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4"><StatusPill status={order.status} /></td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">₴{order.totalAmount.toFixed(2)}</td>
                                    <td className="px-6 py-4 space-x-1">
                                        <button onClick={() => openViewModal(order)} className="p-2 text-slate-500 hover:text-sky-600"><EyeIcon className="w-5 h-5"/></button>
                                        <button onClick={() => openEditModal(order)} className="p-2 text-slate-500 hover:text-rose-600"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-slate-500 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                                        <div className="relative inline-block" ref={el => { if (el) actionMenuRefs.current[order.id] = el; }}>
                                            <button onClick={() => setOpenActionMenu(openActionMenu === order.id ? null : order.id)} className="p-2 text-slate-500 hover:text-slate-800"><EllipsisVerticalIcon className="w-5 h-5"/></button>
                                            {openActionMenu === order.id && (
                                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-10 ring-1 ring-black ring-opacity-5">
                                                    <div className="py-1">
                                                        <button onClick={() => navigate(`/invoice/${order.id}`)} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><DocumentTextIcon className="w-5 h-5"/> Рахунок-фактура</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : <tr><td colSpan={6} className="text-center py-10 text-slate-500">Замовлень, що відповідають фільтрам, не знайдено.</td></tr>}
                        </tbody>
                    </table>
                </div>
                
                <div className="md:hidden">
                  {isLoading ? <div className="p-6 text-center text-slate-500">Завантаження...</div>
                  : orders.length > 0 ? (
                      <ul className="divide-y divide-slate-200">
                          {orders.map(order => (
                              <li key={order.id} className="p-4 space-y-3">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <p className="font-semibold text-rose-600">#{order.id.substring(0,8)}</p>
                                          <p className="font-bold text-slate-800">{order.customerName}</p>
                                      </div>
                                      <StatusPill status={order.status} />
                                  </div>
                                  <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm text-slate-500">{new Date(order.date).toLocaleDateString()}</p>
                                        <p className="text-lg font-bold text-slate-800">₴{order.totalAmount.toFixed(2)}</p>
                                    </div>
                                    <div className="flex space-x-1">
                                      <button onClick={() => openViewModal(order)} className="p-2 text-slate-500 hover:bg-sky-50 rounded-md"><EyeIcon className="w-5 h-5"/></button>
                                      <button onClick={() => openEditModal(order)} className="p-2 text-slate-500 hover:bg-rose-50 rounded-md"><PencilIcon className="w-5 h-5"/></button>
                                      <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-slate-500 hover:bg-red-50 rounded-md"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                  </div>
                              </li>
                          ))}
                      </ul>
                  ) : <div className="py-10 text-center text-slate-500">Замовлень не знайдено.</div>}
                </div>
                
                {totalCount > 0 && <Pagination currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} isLoading={isLoading} />}
            </div>
            
            {modalMode && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200">
                            <h3 className="text-xl font-semibold text-slate-800">{modalMode === 'edit' ? 'Редагувати замовлення' : 'Створити нове замовлення'}</h3>
                            <button onClick={closeModal} disabled={isSubmitting}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{modalError}</div>}
                        
                        <form onSubmit={handleSubmitOrder} className="flex-grow overflow-y-auto pr-2 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label htmlFor="customerId" className="block text-sm font-medium text-slate-700">Клієнт</label>
                                    <select id="customerId" value={activeOrderData.customerId || ''} onChange={e => {
                                        const custId = e.target.value;
                                        const cust = customers.find(c => c.id === custId);
                                        setActiveOrderData(prev => ({ ...prev, customerId: custId, customerName: cust?.name || '' }))
                                    }} required className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg">
                                        <option value="" disabled>Оберіть клієнта</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="date" className="block text-sm font-medium text-slate-700">Дата</label>
                                    <input type="date" id="date" value={activeOrderData.date} onChange={e => setActiveOrderData(prev => ({...prev, date: e.target.value}))} required className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg"/>
                                </div>
                                <div>
                                    <label htmlFor="status" className="block text-sm font-medium text-slate-700">Статус</label>
                                    <select id="status" value={activeOrderData.status} onChange={e => setActiveOrderData(prev => ({...prev, status: e.target.value as Order['status']}))} required className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg">
                                        {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                                    </select>
                                </div>
                                {isAdmin && (
                                    <div>
                                        <label htmlFor="managedByUserEmail" className="block text-sm font-medium text-slate-700">Менеджер</label>
                                        <select id="managedByUserEmail" value={activeOrderData.managedByUserEmail || ''} onChange={e => setActiveOrderData(prev => ({...prev, managedByUserEmail: e.target.value}))} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg">
                                            <option value="">Не призначено</option>
                                            {allOrderManagers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            
                            <div className="pt-4 mt-4 border-t">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-lg font-semibold text-slate-800">Товари в замовленні</h4>
                                    <button type="button" onClick={handleGetAiSuggestions} disabled={isAiLoading || !activeOrderData.items?.some(i => !!i.productId)} className="flex items-center gap-2 text-sm font-semibold text-amber-600 hover:text-amber-800 disabled:opacity-50">
                                        <LightBulbIcon className={`w-5 h-5 ${isAiLoading ? 'animate-pulse' : ''}`}/> {isAiLoading ? 'Думаю...' : '💡 AI Поради'}
                                    </button>
                                </div>
                                {aiError && <p className="text-sm text-red-600">{aiError}</p>}
                                {showAiSuggestions && aiSuggestions.length > 0 && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="text-sm font-semibold text-amber-800">Рекомендовані товари:</h5>
                                            <button type="button" onClick={() => setShowAiSuggestions(false)}><XMarkIcon className="w-4 h-4 text-amber-500"/></button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {aiSuggestions.map(p => (
                                                <button key={p.id} type="button" onClick={() => handleAddSuggestionToOrder(p)} className="flex items-center gap-1.5 text-xs bg-white border border-amber-300 rounded-full px-3 py-1 text-amber-800 hover:bg-amber-100">
                                                    <PlusIcon className="w-3 h-3"/> {p.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="space-y-3">
                                    {(activeOrderData.items || []).map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50/70 rounded-lg">
                                            <div className="col-span-12 md:col-span-5 relative" ref={el => { if(el) productDropdownRefs.current[index] = el; }}>
                                                <label className="text-xs font-medium text-slate-600">Назва товару</label>
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
                                                    className="w-full mt-1 p-2 border-slate-300 rounded-md"
                                                    required
                                                />
                                                {openProductDropdown === index && (
                                                    <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto border">
                                                        {isProductSearching ? <div className="p-3 text-sm text-slate-500">Пошук...</div>
                                                        : productSearchResults.length > 0 ? productSearchResults.map(p => (
                                                            <div key={p.id} onClick={() => handleSelectProduct(index, p)} className="p-3 hover:bg-rose-50 cursor-pointer text-sm">
                                                                <p className="font-semibold">{p.name}</p>
                                                                <p className="text-xs text-slate-500">Залишок: {p.quantity}</p>
                                                            </div>
                                                        )) : <div className="p-3 text-sm text-slate-500">Товарів не знайдено.</div>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="col-span-3 md:col-span-1">
                                                <label className="text-xs font-medium text-slate-600">К-сть</label>
                                                <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} min="1" required className="w-full mt-1 p-2 border-slate-300 rounded-md"/>
                                            </div>
                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-medium text-slate-600">Ціна (₴)</label>
                                                <input type="number" value={item.price} onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)} min="0" step="0.01" required className="w-full mt-1 p-2 border-slate-300 rounded-md"/>
                                            </div>
                                            <div className="col-span-3 md:col-span-2">
                                                <label className="text-xs font-medium text-slate-600">Знижка (%)</label>
                                                <input type="number" value={item.discount} onChange={e => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} min="0" max="100" step="1" className="w-full mt-1 p-2 border-slate-300 rounded-md"/>
                                            </div>
                                            <div className="col-span-2 md:col-span-1 flex items-end">
                                                <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-slate-500 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                                            </div>
                                            <div className="col-span-12 md:col-span-1 text-right text-sm font-semibold flex items-end justify-end">
                                                ₴{(item.quantity * item.price * (1-(item.discount || 0)/100)).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={handleAddItem} className="mt-3 flex items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-800"><PlusIcon className="w-4 h-4"/> Додати товар</button>
                            </div>

                            <div className="pt-4 mt-4 border-t">
                                <label htmlFor="notes" className="block text-sm font-medium text-slate-700">Нотатки</label>
                                <textarea id="notes" value={activeOrderData.notes || ''} onChange={e => setActiveOrderData(prev => ({...prev, notes: e.target.value}))} rows={3} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg"/>
                            </div>
                            
                            <div className="flex justify-end items-center pt-6 space-x-3 border-t border-slate-200">
                                <span className="text-lg font-bold text-slate-800">Всього: ₴{activeOrderData.totalAmount?.toFixed(2) || '0.00'}</span>
                                <button type="button" onClick={closeModal} className="bg-white border border-slate-300 py-2 px-4 rounded-lg" disabled={isSubmitting}>Скасувати</button>
                                <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white py-2 px-4 rounded-lg" disabled={isSubmitting}>
                                    {isSubmitting ? 'Збереження...' : (modalMode === 'edit' ? 'Зберегти зміни' : 'Створити замовлення')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewOrder && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
                            <h3 className="text-xl font-semibold text-slate-800">Деталі замовлення #{viewOrder.id.substring(0, 8)}</h3>
                            <button onClick={closeModal}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div><span className="font-semibold text-slate-500">Клієнт:</span> <span className="font-medium text-slate-800">{viewOrder.customerName}</span></div>
                                <div><span className="font-semibold text-slate-500">Дата:</span> <span className="font-medium text-slate-800">{new Date(viewOrder.date).toLocaleDateString()}</span></div>
                                <div><span className="font-semibold text-slate-500">Статус:</span> <StatusPill status={viewOrder.status} /></div>
                                <div><span className="font-semibold text-slate-500">Сума:</span> <span className="font-bold text-slate-800 text-base">₴{viewOrder.totalAmount.toFixed(2)}</span></div>
                                {viewOrder.managedByUserEmail && <div><span className="font-semibold text-slate-500">Менеджер:</span> <span className="font-medium text-slate-800">{viewOrder.managedByUserEmail}</span></div>}
                            </div>
                            {viewOrder.notes && (
                                <div className="pt-4 border-t">
                                    <p className="font-semibold text-slate-500 mb-1">Нотатки:</p>
                                    <p className="p-3 bg-slate-50 rounded-lg text-slate-700 whitespace-pre-wrap">{viewOrder.notes}</p>
                                </div>
                            )}
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-slate-500 mb-2">Товари:</h4>
                                <ul className="divide-y divide-slate-200 border rounded-lg overflow-hidden">
                                    {viewOrder.items.map((item, i) => (
                                        <li key={item.id || i} className="grid grid-cols-5 gap-2 px-3 py-2 items-center">
                                            <span className="col-span-2 font-medium text-slate-800">{item.productName}</span>
                                            <span className="text-center text-slate-600">{item.quantity} x ₴{item.price.toFixed(2)}</span>
                                            {item.discount > 0 && <span className="text-center text-red-500 text-xs">(-{item.discount}%)</span>}
                                            <span className={`text-right font-semibold text-slate-800 ${item.discount > 0 ? 'col-span-1' : 'col-span-2'}`}>₴{(item.quantity * item.price * (1-(item.discount || 0)/100)).toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 text-right border-t border-slate-200">
                            <button onClick={closeModal} className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg">Закрити</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default OrdersPage;