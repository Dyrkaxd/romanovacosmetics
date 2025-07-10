









import React, { useState, useEffect, useCallback, useMemo, useRef, FC, SVGProps } from 'react';
import { Order, OrderItem, Customer, Product, ManagedUser, PaginatedResponse, NovaPoshtaDepartment } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, FilterIcon, DownloadIcon, ChevronDownIcon, ShareIcon, EllipsisVerticalIcon, TruckIcon } from '../components/Icons';
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
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
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

  // State for searchable product dropdown
  const [openProductDropdown, setOpenProductDropdown] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const productDropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  // State for actions dropdown
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // State for Nova Poshta TTN Modal
  const [activeTtnOrder, setActiveTtnOrder] = useState<Order | null>(null);
  const [npDepartment, setNpDepartment] = useState<NovaPoshtaDepartment | null>(null);
  const [isNpWidgetOpen, setIsNpWidgetOpen] = useState(false);
  const npIframeRef = useRef<HTMLIFrameElement>(null);
  const [packageDetails, setPackageDetails] = useState({
      weight: "0.5",
      length: "20",
      width: "15",
      height: "10",
      description: "Косметичні засоби"
  });

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
      const [customersRes, productsRes, managersRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/customers?pageSize=1000`), // Fetch all customers for dropdown
        authenticatedFetch(`${API_BASE_URL}/products?pageSize=1000`), // Fetch all products for dropdown
        isAdmin ? authenticatedFetch(`${API_BASE_URL}/managedUsers`) : Promise.resolve(null),
        isAdmin ? authenticatedFetch(`${API_BASE_URL}/admins`) : Promise.resolve(null),
      ]);

      const customersData: PaginatedResponse<Customer> = await customersRes.json();
      setCustomers(customersData.data.sort((a,b) => a.name.localeCompare(b.name)));

      const productsData: PaginatedResponse<Product> = await productsRes.json();
      setAvailableProducts(productsData.data);
      
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
      setPageError("Не вдалося завантажити допоміжні дані (клієнти, товари). " + err.message);
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
    const itemToUpdate = { ...items[index], [field]: value };
    
    if (field === 'productId') {
        const product = availableProducts.find(p => p.id === value);
        if (product) {
            itemToUpdate.productName = product.name;
            itemToUpdate.price = product.retailPrice;
            itemToUpdate.salonPriceUsd = product.salonPrice;
            itemToUpdate.exchangeRate = product.exchangeRate;
        }
    }
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

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return availableProducts;
    return availableProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()));
  }, [productSearchTerm, availableProducts]);

    const closeNpWidget = useCallback(() => {
      setIsNpWidgetOpen(false);
    }, []);

    const handleNpWidgetMessage = useCallback((event: MessageEvent) => {
        if (event.origin !== 'https://widget.novapost.com') return;
        const data = event.data;
        if (data && typeof data === 'object' && data.externId) {
            const departmentData: NovaPoshtaDepartment = {
                id: data.externId,
                name: data.name,
                settlementName: data.settlementName,
            };
            setNpDepartment(departmentData);
            closeNpWidget();
        } else if (event.data === 'close') {
            closeNpWidget();
        }
    }, [closeNpWidget]);
    
    const openNpWidget = () => {
        const customer = customers.find(c => c.id === activeTtnOrder?.customerId);
        if (!customer?.phone) {
            setPageError("Неможливо створити ТТН: у клієнта не вказано номер телефону.");
            return;
        }
        setIsNpWidgetOpen(true);
    };

    useEffect(() => {
      if (isNpWidgetOpen && npIframeRef.current && activeTtnOrder) {
          const iframe = npIframeRef.current;
          window.addEventListener('message', handleNpWidgetMessage);

          const handleLoad = () => {
              // Use a timeout to ensure the widget's internal scripts are ready for the message.
              setTimeout(() => {
                  const customer = customers.find(c => c.id === activeTtnOrder.customerId);
                  const recipientCity = customer?.address?.city || '';
                  const data = {
                      apiKey: '',
                      city: recipientCity,
                      theme: 'light',
                      language: 'uk',
                  };
                  iframe.contentWindow?.postMessage(data, '*');
              }, 100);
          };

          iframe.addEventListener('load', handleLoad);
          iframe.src = 'https://widget.novapost.com/division/index.html';

          // Cleanup function
          return () => {
              window.removeEventListener('message', handleNpWidgetMessage);
              iframe.removeEventListener('load', handleLoad);
              if (iframe) {
                iframe.src = 'about:blank';
              }
          };
      }
  }, [isNpWidgetOpen, activeTtnOrder, customers, handleNpWidgetMessage]);
  
    const handleCreateTtn = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError(null);
        if (!activeTtnOrder || !npDepartment) {
            setModalError('Будь ласка, виберіть відділення "Нової Пошти".');
            return;
        }

        if (!npDepartment.id || !npDepartment.settlementName) {
            setModalError('Неповні дані від віджета "Нової Пошти". Спробуйте обрати відділення ще раз.');
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
                recipientSettlementName: npDepartment.settlementName,
                recipientAddressRef: npDepartment.id,
                weight: packageDetails.weight,
                volumeGeneral: (parseFloat(packageDetails.length) * parseFloat(packageDetails.width) * parseFloat(packageDetails.height)) / 1000000,
                description: packageDetails.description,
                cost: activeTtnOrder.totalAmount,
            };
            
            const res = await authenticatedFetch(`${API_BASE_URL}/novaPoshta`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).message);

            setSuccessMessage(`ТТН успішно створено для замовлення #${activeTtnOrder.id.substring(0,8)}.`);
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
                                                onFocus={() => {setOpenProductDropdown(index); setProductSearchTerm('');}}
                                                onChange={e => setProductSearchTerm(e.target.value)}
                                                className="w-full p-2 border-slate-300 rounded-lg"/>
                                            {openProductDropdown === index && (
                                                <div className="absolute top-full left-0 w-full max-h-60 overflow-y-auto bg-white border shadow-lg z-20 rounded-b-lg">
                                                    {filteredProducts.map(p => (
                                                        <div key={p.id} onClick={() => { handleItemChange(index, 'productId', p.id); setOpenProductDropdown(null); }} className="p-2 hover:bg-rose-100 cursor-pointer text-sm">
                                                            {p.name}
                                                        </div>
                                                    ))}
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
                    <div className="p-4 space-y-4">
                        <div>
                            <p className="text-sm font-medium text-slate-700">Одержувач: <span className="font-bold text-slate-900">{activeTtnOrder.customerName}</span></p>
                        </div>
                        
                        {/* Nova Poshta Widget Button */}
                        <div className="nova-poshta-button" onClick={openNpWidget}>
                          <div className="logo">
                            <svg width="129" height="18" viewBox="0 0 129 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.48791 14.0369V10.6806H6.64191V14.0369H4.46643L7.10879 16.6861C7.64025 17.2189 8.49951 17.2189 9.03096 16.6861L11.6733 14.0369H9.48791ZM3.04095 12.6077V5.38722L0.398589 8.03639C-0.132863 8.56922 -0.132863 9.4307 0.398589 9.96352L3.04095 12.6077ZM6.64191 3.96304V7.31933H9.48791V3.96304H11.6634L9.02103 1.31386C8.48958 0.78104 7.63031 0.78104 7.09886 1.31386L4.4565 3.96304H6.64191ZM15.7263 8.03639L13.0839 5.38722V12.6077L15.7263 9.96352C16.2577 9.4307 16.2577 8.56922 15.7263 8.03639Z" fill="#DA291C"/><path d="M24.2303 7.63804V5.12332C24.2303 4.46102 23.7437 3.97302 23.0833 3.97302L20.1561 3.98249V6.64162L21.3653 6.63215V14.0369H24.2353V10.3719H27.8202V14.0369H30.6902V3.96804H27.8202V7.63804H24.2303Z" fill="#DA291C"/><path d="M37.2792 3.8235C34.2553 3.8235 32.0457 6.00957 32.0457 9.00234C32.0457 11.9951 34.2553 14.1812 37.2792 14.1812C40.3031 14.1812 42.5126 11.9951 42.5126 9.00234C42.5126 6.00957 40.3031 3.8235 37.2792 3.8235ZM37.2792 11.3727C35.9187 11.3727 34.9157 10.3668 34.9157 9.00234C34.9157 7.63792 35.9187 6.63203 37.2792 6.63203C38.6397 6.63203 39.6427 7.63792 39.6427 9.00234C39.6427 10.3668 38.6397 11.3727 37.2792 11.3727Z" fill="#DA291C"/><path d="M51.3858 8.70866C52.0958 8.27543 52.5378 7.53347 52.5378 6.64211C52.5378 5.08846 51.5348 3.96804 49.5387 3.96804H43.8733V14.0319H49.5387C51.6341 14.0319 52.8506 12.8119 52.8506 11.1288C52.8506 10.0532 52.2796 9.17675 51.3858 8.70866ZM46.5397 6.21386H48.6747C49.35 6.21386 49.7373 6.54252 49.7373 7.10522C49.7373 7.66792 49.35 7.99657 48.6747 7.99657H46.5397V6.21386ZM48.8783 11.8209H46.5397V9.95358H48.8783C49.5933 9.95358 49.9955 10.2972 49.9955 10.8898C49.9955 11.4774 49.5933 11.8209 48.8783 11.8209Z" fill="#DA291C"/><path d="M57.2347 3.96804L53.2774 14.0319H56.331L56.9666 12.1795H60.9984L61.634 14.0319H64.7472L60.7899 3.96804H57.2347ZM57.7462 9.9237L58.8782 6.63215H59.0967L60.2288 9.9237H57.7462Z" fill="#DA291C"/><path d="M78.4567 3.96804H68.8538V6.62717H70.2887V14.0319H73.1587V6.62717H76.7436V14.0319H79.6136V5.11834C79.6037 4.38633 79.1866 3.96804 78.4567 3.96804Z" fill="#DA291C"/><path d="M86.1973 3.8235C83.1734 3.8235 80.9639 6.00957 80.9639 9.00234C80.9639 11.9951 83.1734 14.1812 86.1973 14.1812C89.2212 14.1812 91.4307 11.9951 91.4307 9.00234C91.4307 6.00957 89.2261 3.8235 86.1973 3.8235ZM86.1973 11.3727C84.8368 11.3727 83.8338 10.3668 83.8338 9.00234C83.8338 7.63792 84.8368 6.63203 86.1973 6.63203C87.5578 6.63203 88.5608 7.63792 88.5608 9.00234C88.5608 10.3668 87.5628 11.3727 86.1973 11.3727Z" fill="#DA291C"/><path d="M103.978 11.3728H101.252V3.96804H98.3872V11.3728H95.6613V3.96804H92.7963V14.0369H106.848V3.96804H103.978V11.3728Z" fill="#DA291C"/><path d="M117.955 6.62717V3.96804H108.209V6.62717H111.65V14.0369H114.514V6.62717H117.955Z" fill="#DA291C"/><path d="M125.458 14.0369H128.571L124.614 3.97305H121.059L117.102 14.0369H120.155L120.791 12.1845H124.823L125.458 14.0369ZM121.565 9.92373L122.697 6.63218H122.916L124.048 9.92373H121.565Z" fill="#DA291C"/></svg>
                          </div>
                          <div className="angle"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M5.49399 1.44891L10.0835 5.68541L10.1057 5.70593C10.4185 5.99458 10.6869 6.24237 10.8896 6.4638C11.1026 6.69642 11.293 6.95179 11.4023 7.27063C11.5643 7.74341 11.5643 8.25668 11.4023 8.72946C11.293 9.0483 11.1026 9.30367 10.8896 9.53629C10.6869 9.75771 10.4184 10.0055 10.1057 10.2942L10.0835 10.3147L5.49398 14.5511L4.47657 13.4489L9.06607 9.21246C9.40722 8.89756 9.62836 8.69258 9.78328 8.52338C9.93272 8.36015 9.96962 8.28306 9.98329 8.24318C10.0373 8.08559 10.0373 7.9145 9.98329 7.7569C9.96963 7.71702 9.93272 7.63993 9.78328 7.4767C9.62837 7.3075 9.40722 7.10252 9.06608 6.78761L4.47656 2.55112L5.49399 1.44891Z" fill="#475569"/></svg></div>
                          <div className="wrapper">
                            {npDepartment ? (
                                <>
                                    <span className="text" style={{ marginBottom: '5px' }}>{npDepartment.name}</span>
                                    <span className="text-description">{npDepartment.settlementName}</span>
                                </>
                            ) : (
                                <span className="text-description">Обрати відділення або поштомат</span>
                            )}
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
                    </div>
                    <div className="flex justify-end gap-3 p-4 border-t bg-slate-50">
                        <button type="button" onClick={closeModal} className="bg-white border border-slate-300 py-2 px-4 rounded-lg" disabled={isSubmitting}>Скасувати</button>
                        <button type="submit" disabled={isSubmitting || !npDepartment} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isSubmitting ? 'Створення...' : 'Створити ТТН'}
                        </button>
                    </div>
                </div>
            </form>
            {isNpWidgetOpen && (
                 <div className="modal-overlay" style={{display: 'flex', zIndex: 50}}>
                    <div className="modal">
                        <header className="modal-header">
                            <h2>Вибрати відділення</h2>
                            <span className="modal-close" onClick={closeNpWidget}>&times;</span>
                        </header>
                        <iframe ref={npIframeRef} className="modal-iframe" allow="geolocation" title="Nova Poshta Widget"></iframe>
                    </div>
                 </div>
            )}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;