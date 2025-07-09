import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Order, OrderItem, Customer, Product, ManagedUser, PaginatedResponse, NovaPoshtaFormData } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, FilterIcon, DownloadIcon, ChevronDownIcon, ShareIcon, EllipsisVerticalIcon, TruckIcon, PrinterIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import { Database } from '../types/supabase';
import Pagination from '../components/Pagination';
import { useAuth } from '../AuthContext';

type AdminRow = Database['public']['Tables']['admins']['Row'];

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


const API_BASE_URL = '/api';

const OrdersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [orders, setOrders] = useState<Order[]>([]);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editableOrderStatus, setEditableOrderStatus] = useState<Order['status'] | undefined>(undefined);
  const [editableOrderNotes, setEditableOrderNotes] = useState<string>('');
  
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [activeOrderData, setActiveOrderData] = useState<Partial<Order> | null>(null);
  const initialNewOrderItem: OrderItem = { productId: '', productName: '', quantity: 1, price: 0, discount: 0 };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [allOrderManagers, setAllOrderManagers] = useState<{ email: string; name: string }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Nova Poshta Modal State
  const [isNovaPoshtaModalOpen, setIsNovaPoshtaModalOpen] = useState(false);
  const [novaPoshtaFormData, setNovaPoshtaFormData] = useState<NovaPoshtaFormData>({
    warehouse: '', weight: 0.5, length: 20, width: 15, height: 10, description: 'Косметичні засоби'
  });
  const [isCreatingTtn, setIsCreatingTtn] = useState(false);
  
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close product dropdown
      if (openProductDropdown !== null && productDropdownRefs.current[openProductDropdown] && !productDropdownRefs.current[openProductDropdown]!.contains(event.target as Node)) {
        setOpenProductDropdown(null);
      }
      // Close action menu
      if (openActionMenu && actionMenuRefs.current[openActionMenu] && !actionMenuRefs.current[openActionMenu]!.contains(event.target as Node)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openProductDropdown, openActionMenu]);


  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);


  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const promises = [
        authenticatedFetch(`${API_BASE_URL}/customers?pageSize=10000`),
        authenticatedFetch(`${API_BASE_URL}/products?pageSize=10000`),
        authenticatedFetch(`${API_BASE_URL}/managedUsers`),
      ];

      if (isAdmin) {
        promises.push(authenticatedFetch(`${API_BASE_URL}/admins`));
      }

      const responses = await Promise.all(promises);

      const [custRes, prodRes, managerRes] = responses;
      const adminRes = isAdmin ? responses[3] : null;

      if (!custRes.ok) throw new Error(`Failed to fetch customers: ${custRes.statusText}`);
      if (!prodRes.ok) throw new Error(`Failed to fetch products: ${prodRes.statusText}`);
      if (!managerRes.ok) throw new Error(`Failed to fetch managers: ${managerRes.statusText}`);
      if (adminRes && !adminRes.ok) throw new Error(`Failed to fetch admins: ${adminRes.statusText}`);

      const custData = await custRes.json();
      const prodData = await prodRes.json();
      const managerData: ManagedUser[] = await managerRes.json();
      const adminData: AdminRow[] = adminRes ? await adminRes.json() : [];
      
      setCustomers(custData?.data || custData || []);
      setAvailableProducts(prodData?.data || prodData || []);
      
      const combinedUsers = [
        ...(managerData || []).map(m => ({ email: m.email, name: m.name })),
        ...(adminData || []).map(a => ({ email: a.email, name: a.email }))
      ];
      const uniqueUsers = Array.from(new Map(combinedUsers.map(item => [item.email.toLowerCase(), item])).values())
        .sort((a,b) => a.name.localeCompare(b.name));
      
      setAllOrderManagers(uniqueUsers);

    } catch (err: any) {
      console.error("Failed to fetch auxiliary data:", err);
      setPageError(err.message || 'Could not load required data for orders.');
    }
  }, [isAdmin]);
  
  const fetchOrders = useCallback(async (page = 1) => {
    setIsLoading(true);
    setPageError(null);
    setCurrentPage(page);

    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: searchTerm,
        status: filterStatus,
        customerId: filterCustomerId,
        managerEmail: filterManagerEmail,
        startDate: filterStartDate,
        endDate: filterEndDate,
    });

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/orders?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch orders' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: PaginatedResponse<Order> = await response.json();
      setOrders(data.data);
      setTotalCount(data.totalCount);
      setCurrentPage(data.currentPage);
      setPageSize(data.pageSize);
    } catch (err: any) {
      console.error("Failed to fetch orders:", err);
      setPageError(err.message || 'Could not load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, searchTerm, filterStatus, filterCustomerId, filterManagerEmail, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    fetchOrders(1); // Fetch first page when filters change
  }, [fetchOrders]);


  const resetFilters = () => {
    setFilterStatus('All');
    setFilterCustomerId('All');
    setFilterManagerEmail('All');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchTerm('');
    setCurrentPage(1);
  };
  
  const handlePageChange = (page: number) => {
      fetchOrders(page);
  };
  
  const handlePageSizeChange = (size: number) => {
      setPageSize(size);
      setCurrentPage(1); // Reset to first page
  };


  const calculateTotalAmount = (items: OrderItem[] = []): number => {
    return items.reduce((sum, item) => {
        const itemTotal = (Number(item.quantity) * Number(item.price));
        const discountAmount = itemTotal * (Number(item.discount || 0) / 100);
        return sum + (itemTotal - discountAmount);
    }, 0);
  };

  const handleItemChange = (index: number, field: keyof OrderItem | 'productIdSelect', value: string | number) => {
    setActiveOrderData(prev => {
      if (!prev) return null;
      const items = [...(prev.items || [])];
      const currentItem = { ...items[index] };

      if (field === 'productIdSelect') {
        const selectedProductId = value as string;
        const product = availableProducts.find(p => p.id === selectedProductId);
        if (product) {
          currentItem.productId = product.id;
          currentItem.productName = product.name;
          currentItem.price = product.retailPrice * product.exchangeRate; // Price is retail price * exchange rate
        } else { 
          currentItem.productId = ''; 
          currentItem.productName = 'Товар не знайдено'; 
          currentItem.price = 0; 
        }
      } else if (field === 'quantity' || field === 'price' || field === 'discount') {
        currentItem[field as 'quantity' | 'price' | 'discount'] = Number(value) < 0 ? 0 : Number(value);
      } else if (field === 'productName'){ 
          currentItem[field] = value as string;
      }
      
      items[index] = currentItem;
      return { ...prev, items };
    });
  };
  
  const addItem = () => {
    setActiveOrderData(prev => {
      if (!prev) return null;
      const newItems = [...(prev.items || []), { ...initialNewOrderItem }];
      return { ...prev, items: newItems }
    });
  };

  const removeItem = (index: number) => {
    setActiveOrderData(prev => {
      if (!prev) return null;
      const newItems = (prev.items || []).filter((_, i) => i !== index);
      return { ...prev, items: newItems }
    });
  };


  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!activeOrderData) return;

    if (!activeOrderData.customerId) {
      setModalError("Будь ласка, виберіть клієнта."); return;
    }
    const validItems = (activeOrderData.items || []).filter(
        item => item.productId && item.productName && Number(item.quantity) > 0 && Number(item.price) >= 0
    );
    if (validItems.length === 0) {
      setModalError("Додайте принаймні один дійсний товар."); return;
    }
    
    const selectedCustomer = customers.find(c => c.id === activeOrderData.customerId);
    if (!selectedCustomer) {
       setModalError("Обраний клієнт не знайдений."); return;
    }

    const isEditing = modalMode === 'edit';
    const totalAmount = calculateTotalAmount(validItems);

    const orderPayload: Partial<Order> = {
      ...(isEditing && activeOrderData.id ? { id: activeOrderData.id } : {}),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      date: isEditing && activeOrderData.date ? activeOrderData.date : new Date().toISOString(), // Use full ISO string
      status: activeOrderData.status || 'Ordered',
      items: validItems.map(item => ({...item, id: isEditing ? item.id : undefined})),
      totalAmount: totalAmount,
      notes: activeOrderData.notes || '',
    };

    setIsLoading(true);
    try {
      const url = isEditing && activeOrderData.id ? `${API_BASE_URL}/orders/${activeOrderData.id}` : `${API_BASE_URL}/orders`;
      const method = isEditing ? 'PUT' : 'POST';
      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(orderPayload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to ${isEditing ? 'update' : 'create'} order` }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      fetchOrders(currentPage); 
      closeOrderModal();
    } catch (err: any) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} order:`, err);
      setModalError(err.message || `Could not ${isEditing ? 'update' : 'create'} order.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const openOrderModal = (mode: 'add' | 'edit', order: Order | null = null) => {
    setModalError(null);
    setModalMode(mode);
    if (mode === 'add') {
      setActiveOrderData({ customerId: '', status: 'Ordered', items: [{ ...initialNewOrderItem }], totalAmount: 0, notes: '' });
    } else if (order) {
      setActiveOrderData({ ...order, items: order.items.map(item => ({ ...item })) });
    }
  };

  const closeOrderModal = () => {
    setModalMode(null);
    setActiveOrderData(null);
  };

  const handleViewOrder = (order: Order) => {
    setViewOrder(order);
    setEditableOrderStatus(order.status);
    setEditableOrderNotes(order.notes || '');
    setIsNovaPoshtaModalOpen(false); // Ensure other modals are closed
  };
  
  const handleUpdateOrderInViewModal = async () => {
    if (!viewOrder) return;
    const statusChanged = editableOrderStatus !== viewOrder.status;
    const notesChanged = editableOrderNotes !== (viewOrder.notes || '');
    if (!statusChanged && !notesChanged) return;

    setIsLoading(true);
    setModalError(null);
    try {
      const payload: Partial<Order> = { ...viewOrder };
      if (statusChanged) payload.status = editableOrderStatus;
      if (notesChanged) payload.notes = editableOrderNotes;
      
      const response = await authenticatedFetch(`${API_BASE_URL}/orders/${viewOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update order' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const updatedOrderFromServer = await response.json();
      setOrders(prevOrders => prevOrders.map(o => o.id === viewOrder.id ? updatedOrderFromServer : o));
      setViewOrder(updatedOrderFromServer);
    } catch (err: any) {
      console.error("Failed to update order:", err);
      setModalError(err.message || "Could not update order.");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModalView = () => {
    setViewOrder(null);
    setEditableOrderStatus(undefined);
    setEditableOrderNotes('');
    setModalError(null);
  };

  const handleDeleteOrder = async (orderId: string) => {
    setOpenActionMenu(null);
    if (window.confirm('Ви впевнені, що хочете видалити це замовлення? Цю дію неможливо скасувати.')) {
      setIsLoading(true); 
      setPageError(null);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 204) {
          const errData = await response.json().catch(() => ({ message: 'Server error' }));
          throw new Error(errData.message || 'Could not delete order.');
        }
        const newTotalCount = totalCount - 1;
        const newTotalPages = Math.ceil(newTotalCount / pageSize);
        const newCurrentPage = (currentPage > newTotalPages && newTotalPages > 0) ? newTotalPages : currentPage;
        fetchOrders(newCurrentPage);
      } catch (err: any) {
        console.error("Failed to delete order:", err);
        setPageError(err.message || 'Could not delete order. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleShareInvoice = (orderId: string) => {
    setOpenActionMenu(null);
    const invoiceUrl = `${window.location.origin}/#/invoice/${orderId}`;
    navigator.clipboard.writeText(invoiceUrl).then(() => {
        setSuccessMessage('Посилання на рахунок скопійовано!');
    }, (err) => {
        console.error('Could not copy text: ', err);
        setPageError('Не вдалося скопіювати посилання.');
    });
  };
  
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return availableProducts;
    return availableProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()));
  }, [productSearchTerm, availableProducts]);

  const openNovaPoshtaModal = (order: Order) => {
    setOpenActionMenu(null);
    setViewOrder(order);
    setNovaPoshtaFormData({
      warehouse: '', weight: 0.5, length: 20, width: 15, height: 10, description: 'Косметичні засоби'
    });
    setModalError(null);
    setIsNovaPoshtaModalOpen(true);
  };
  
  const closeNovaPoshtaModal = () => {
    setIsNovaPoshtaModalOpen(false);
    setViewOrder(null);
    setModalError(null);
  };

  const handleCreateTtn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewOrder) return;
    
    const { warehouse, weight, length, width, height, description } = novaPoshtaFormData;

    if (!warehouse.trim() || !weight || !length || !width || !height || !description.trim()) {
      setModalError('Будь ласка, заповніть усі поля для створення ТТН.');
      return;
    }
    
    setModalError(null);
    setIsCreatingTtn(true);

    try {
      const payload = { orderId: viewOrder.id, ...novaPoshtaFormData };
      const response = await authenticatedFetch(`${API_BASE_URL}/novaPoshta`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Не вдалося створити ТТН.' }));
        throw new Error(errorData.message);
      }
      
      const updatedOrder: Order = await response.json();
      
      // Update state
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setSuccessMessage(`ТТН ${updatedOrder.novaPoshtaTtn} успішно створено!`);
      closeNovaPoshtaModal();

    } catch (err: any) {
      setModalError(err.message || 'Сталася помилка. Спробуйте ще раз.');
    } finally {
      setIsCreatingTtn(false);
    }
  };

  return (
    <div className="space-y-6">
       {successMessage && 
        <div className="fixed top-5 right-5 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50 animate-pulse" role="alert">
          <span className="block sm:inline">{successMessage}</span>
        </div>
      }
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Замовлення</h2>
        <button
          onClick={() => openOrderModal('add')}
          className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
          aria-label="Створити нове замовлення"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="ml-2">Створити замовлення</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
        <input
            type="search"
            aria-label="Пошук замовлень"
            placeholder="Пошук за номером замовлення, ім'ям клієнта..."
            className="w-full sm:flex-grow p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
        <button 
            onClick={() => setShowFilters(!showFilters)}
            className="w-full sm:w-auto flex items-center justify-center p-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
        >
            <FilterIcon className="w-5 h-5 mr-2" />
            <span>Фільтри</span>
        </button>
      </div>

       {showFilters && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               <div>
                 <label htmlFor="filterStatus" className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                 <select id="filterStatus" value={filterStatus} onChange={e => setFilterStatus(e.target.value as Order['status'] | 'All')} className="w-full p-2 border border-slate-300 rounded-lg">
                    <option value="All">Всі статуси</option>
                    {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                 </select>
               </div>
               {isAdmin && (
                  <div>
                    <label htmlFor="filterManager" className="block text-sm font-medium text-slate-700 mb-1">Менеджер</label>
                    <select id="filterManager" value={filterManagerEmail} onChange={e => setFilterManagerEmail(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg">
                      <option value="All">Всі менеджери</option>
                      {allOrderManagers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                    </select>
                  </div>
               )}
               <div>
                  <label htmlFor="filterCustomer" className="block text-sm font-medium text-slate-700 mb-1">Клієнт</label>
                  <select id="filterCustomer" value={filterCustomerId} onChange={e => setFilterCustomerId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg">
                     <option value="All">Всі клієнти</option>
                     {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
               </div>
               <div>
                  <label htmlFor="filterStartDate" className="block text-sm font-medium text-slate-700 mb-1">З дати</label>
                  <input type="date" id="filterStartDate" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg"/>
               </div>
               <div>
                  <label htmlFor="filterEndDate" className="block text-sm font-medium text-slate-700 mb-1">До дати</label>
                  <input type="date" id="filterEndDate" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg"/>
               </div>
            </div>
            <div className="mt-4 text-right">
                <button onClick={resetFilters} className="text-sm font-semibold text-rose-600 hover:underline">Скинути фільтри</button>
            </div>
        </div>
      )}

      {pageError && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{pageError}</div>}
      
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Замовлення</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden sm:table-cell">Клієнт</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden lg:table-cell">Дата</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Сума</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Статус</th>
                {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden xl:table-cell">Менеджер</th>}
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Дії</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                 <tr><td colSpan={isAdmin ? 7 : 6} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження...</td></tr>
              ) : orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-rose-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-rose-600">#{order.id.substring(0, 6)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-medium hidden sm:table-cell">{order.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden lg:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">₴{order.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><StatusPill status={order.status}/></td>
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden xl:table-cell">{allOrderManagers.find(m => m.email === order.managedByUserEmail)?.name || order.managedByUserEmail || 'N/A'}</td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                        <div className="relative inline-block text-left" ref={el => { actionMenuRefs.current[order.id] = el; }}>
                            <button onClick={() => setOpenActionMenu(openActionMenu === order.id ? null : order.id)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                                <EllipsisVerticalIcon className="w-5 h-5"/>
                            </button>
                            {openActionMenu === order.id && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                    <div className="py-1" role="menu" aria-orientation="vertical">
                                        <button onClick={() => { handleViewOrder(order); setOpenActionMenu(null); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><EyeIcon className="w-5 h-5 mr-3"/>Переглянути</button>
                                        <button onClick={() => { openOrderModal('edit', order); setOpenActionMenu(null); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><PencilIcon className="w-5 h-5 mr-3"/>Редагувати</button>
                                        <hr className="my-1"/>
                                        <button onClick={() => handleShareInvoice(order.id)} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><ShareIcon className="w-5 h-5 mr-3"/>Поділитися рахунком</button>
                                        <button onClick={() => openNovaPoshtaModal(order)} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><TruckIcon className="w-5 h-5 mr-3"/>Створити ТТН</button>
                                        <hr className="my-1"/>
                                        <button onClick={() => handleDeleteOrder(order.id)} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"><TrashIcon className="w-5 h-5 mr-3"/>Видалити</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-6 py-10 text-center text-sm text-slate-500">
                  {!pageError && (totalCount === 0 && searchTerm === '' ? "Замовлень ще немає. Натисніть 'Створити замовлення', щоб почати." : "Замовлень, що відповідають вашому пошуку, не знайдено.")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalCount > 0 && (
          <Pagination currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} isLoading={isLoading}/>
        )}
      </div>

       {modalMode && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200">
                    <h3 className="text-xl font-semibold text-slate-800">{modalMode === 'edit' ? 'Редагувати замовлення' : 'Створити нове замовлення'}</h3>
                    <button onClick={closeOrderModal} disabled={isLoading}><XMarkIcon className="w-6 h-6"/></button>
                </div>
                {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
                <form onSubmit={handleSubmitOrder} className="space-y-4 overflow-y-auto pr-2 flex-grow">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="customer" className="block text-sm font-medium text-slate-700 mb-1">Клієнт <span className="text-red-500">*</span></label>
                            <select
                                id="customer"
                                value={activeOrderData?.customerId || ''}
                                onChange={e => setActiveOrderData(prev => prev ? { ...prev, customerId: e.target.value } : null)}
                                required
                                className="w-full p-2.5 border border-slate-300 rounded-lg"
                            >
                                <option value="" disabled>Виберіть клієнта</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                            <select
                                id="status"
                                value={activeOrderData?.status || 'Ordered'}
                                onChange={e => setActiveOrderData(prev => prev ? { ...prev, status: e.target.value as Order['status'] } : null)}
                                className="w-full p-2.5 border border-slate-300 rounded-lg"
                            >
                                {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                        <h4 className="text-md font-semibold text-slate-700">Позиції замовлення</h4>
                        <div className="grid grid-cols-12 gap-x-2 text-xs font-semibold text-slate-500 px-2">
                            <div className="col-span-5">Товар</div>
                            <div className="col-span-2 text-center">К-сть</div>
                            <div className="col-span-2 text-center">Ціна (₴)</div>
                            <div className="col-span-2 text-center">Знижка (%)</div>
                            <div className="col-span-1"></div>
                        </div>
                        {(activeOrderData?.items || []).map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50">
                                <div className="col-span-5" ref={el => { productDropdownRefs.current[index] = el; }}>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Пошук товару..."
                                            value={openProductDropdown === index ? productSearchTerm : item.productName}
                                            onFocus={() => { setOpenProductDropdown(index); setProductSearchTerm(''); }}
                                            onChange={(e) => { setOpenProductDropdown(index); setProductSearchTerm(e.target.value); }}
                                            className="w-full p-2 border border-slate-300 rounded-md text-sm"
                                        />
                                        {openProductDropdown === index && (
                                            <div className="absolute z-20 w-full bg-white shadow-lg max-h-60 overflow-auto border rounded-md mt-1">
                                                {filteredProducts.length > 0 ? filteredProducts.map(product => (
                                                    <div
                                                        key={product.id}
                                                        className="p-2 hover:bg-rose-50 cursor-pointer text-sm"
                                                        onClick={() => {
                                                            handleItemChange(index, 'productIdSelect', product.id);
                                                            setOpenProductDropdown(null);
                                                        }}
                                                    >
                                                        {product.name}
                                                    </div>
                                                )) : <div className="p-2 text-sm text-slate-500">Товарів не знайдено</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} min="1" className="w-full p-2 border border-slate-300 rounded-md text-sm text-center"/>
                                </div>
                                <div className="col-span-2">
                                    <input type="number" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} min="0" step="0.01" className="w-full p-2 border border-slate-300 rounded-md text-sm text-center"/>
                                </div>
                                <div className="col-span-2">
                                    <input type="number" value={item.discount || 0} onChange={e => handleItemChange(index, 'discount', e.target.value)} min="0" max="100" className="w-full p-2 border border-slate-300 rounded-md text-sm text-center"/>
                                </div>
                                <div className="col-span-1 text-center">
                                    <button type="button" onClick={() => removeItem(index)} className="p-2 text-slate-400 hover:text-red-500" title="Видалити позицію"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                        ))}
                         <button type="button" onClick={addItem} className="flex items-center text-sm font-semibold text-rose-600 hover:text-rose-700">
                            <PlusIcon className="w-4 h-4 mr-1"/> Додати позицію
                        </button>
                    </div>
                    
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">Нотатки до замовлення</label>
                      <textarea 
                        id="notes" 
                        value={activeOrderData?.notes || ''}
                        onChange={e => setActiveOrderData(prev => prev ? { ...prev, notes: e.target.value } : null)}
                        rows={3} 
                        className="w-full p-2.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    
                    <div className="text-right font-bold text-lg text-slate-800">
                        Загальна сума: ₴{calculateTotalAmount(activeOrderData?.items).toFixed(2)}
                    </div>

                    <div className="flex justify-end pt-6 space-x-3 border-t">
                      <button type="button" onClick={closeOrderModal} className="bg-white border border-slate-300 py-2 px-4 rounded-lg" disabled={isLoading}>Скасувати</button>
                      <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg" disabled={isLoading}>
                        {isLoading ? (modalMode === 'edit' ? 'Збереження...' : 'Створення...') : (modalMode === 'edit' ? 'Зберегти зміни' : 'Створити замовлення')}
                      </button>
                    </div>
                </form>
            </div>
        </div>
      )}

       {isNovaPoshtaModalOpen && viewOrder && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center pb-4 mb-6 border-b">
              <h3 className="text-xl font-semibold">Створення ТТН для замовлення #{viewOrder.id.substring(0,6)}</h3>
              <button onClick={closeNovaPoshtaModal} disabled={isCreatingTtn}><XMarkIcon className="w-6 h-6"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
            <form onSubmit={handleCreateTtn} className="space-y-4">
              <div>
                  <label htmlFor="warehouse" className="block text-sm font-medium text-slate-700">Відділення/поштомат Нової Пошти <span className="text-red-500">*</span></label>
                  <input type="text" id="warehouse" value={novaPoshtaFormData.warehouse} onChange={e => setNovaPoshtaFormData({...novaPoshtaFormData, warehouse: e.target.value})} placeholder="Напр. м. Київ, відділення №15" required className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="weight" className="block text-sm font-medium text-slate-700">Вага, кг</label>
                    <input type="number" id="weight" value={novaPoshtaFormData.weight} onChange={e => setNovaPoshtaFormData({...novaPoshtaFormData, weight: parseFloat(e.target.value)})} step="0.1" className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg" />
                  </div>
                   <div>
                    <label htmlFor="length" className="block text-sm font-medium text-slate-700">Довжина, см</label>
                    <input type="number" id="length" value={novaPoshtaFormData.length} onChange={e => setNovaPoshtaFormData({...novaPoshtaFormData, length: parseFloat(e.target.value)})} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg" />
                  </div>
                   <div>
                    <label htmlFor="width" className="block text-sm font-medium text-slate-700">Ширина, см</label>
                    <input type="number" id="width" value={novaPoshtaFormData.width} onChange={e => setNovaPoshtaFormData({...novaPoshtaFormData, width: parseFloat(e.target.value)})} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg" />
                  </div>
                   <div>
                    <label htmlFor="height" className="block text-sm font-medium text-slate-700">Висота, см</label>
                    <input type="number" id="height" value={novaPoshtaFormData.height} onChange={e => setNovaPoshtaFormData({...novaPoshtaFormData, height: parseFloat(e.target.value)})} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg" />
                  </div>
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">Опис відправлення</label>
                <input type="text" id="description" value={novaPoshtaFormData.description} onChange={e => setNovaPoshtaFormData({...novaPoshtaFormData, description: e.target.value})} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg" />
              </div>
              <div className="flex justify-end pt-6 space-x-3 border-t">
                  <button type="button" onClick={closeNovaPoshtaModal} className="bg-white border border-slate-300 py-2 px-4 rounded-lg" disabled={isCreatingTtn}>Скасувати</button>
                  <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white py-2 px-4 rounded-lg flex items-center" disabled={isCreatingTtn}>
                    <TruckIcon className="w-5 h-5 mr-2"/> {isCreatingTtn ? 'Створення...' : 'Створити ТТН'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewOrder && !isNovaPoshtaModalOpen && (
         <div role="dialog" aria-modal="true" aria-labelledby="view-order-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-4 border-b">
              <h3 id="view-order-modal-title" className="text-xl font-semibold text-slate-800">Замовлення #{viewOrder.id.substring(0, 6)}</h3>
              <button onClick={closeModalView} disabled={isLoading}><XMarkIcon className="w-6 h-6"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
            <div className="space-y-4 overflow-y-auto pr-2 flex-grow">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <h4 className="font-semibold text-slate-500 mb-2">Деталі замовлення</h4>
                    <p><span className="font-medium text-slate-600 w-28 inline-block">Клієнт:</span> {viewOrder.customerName}</p>
                    <p><span className="font-medium text-slate-600 w-28 inline-block">Дата:</span> {new Date(viewOrder.date).toLocaleDateString()}</p>
                    <p><span className="font-medium text-slate-600 w-28 inline-block">Сума:</span> ₴{viewOrder.totalAmount.toFixed(2)}</p>
                    <div className="flex items-center mt-1">
                      <label htmlFor="status" className="font-medium text-slate-600 w-28 inline-block">Статус:</label>
                      <select id="status" value={editableOrderStatus} onChange={e => setEditableOrderStatus(e.target.value as Order['status'])} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2">
                        {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                      </select>
                    </div>
                 </div>
                 {viewOrder.novaPoshtaTtn && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">Інформація про доставку</h4>
                        <p><span className="font-medium text-blue-700">ТТН Нової Пошти:</span></p>
                        <p className="font-bold text-blue-900 text-lg">{viewOrder.novaPoshtaTtn}</p>
                        {viewOrder.novaPoshtaPrintUrl && 
                           <a href={viewOrder.novaPoshtaPrintUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center mt-2 text-sm text-rose-600 hover:underline">
                             <PrinterIcon className="w-4 h-4 mr-1"/> Роздрукувати ТТН
                           </a>
                        }
                    </div>
                 )}
               </div>
               <div>
                  <label htmlFor="notes" className="font-semibold text-slate-500">Нотатки до замовлення:</label>
                  <textarea id="notes" value={editableOrderNotes} onChange={e => setEditableOrderNotes(e.target.value)} rows={3} className="mt-1 block w-full p-2.5 border-slate-300 rounded-lg"/>
               </div>
               <div className="border border-slate-200 rounded-lg overflow-hidden mt-4">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50"><tr className="text-left text-xs font-semibold text-slate-500 uppercase"><th className="px-4 py-2">Товар</th><th className="px-4 py-2">К-сть</th><th className="px-4 py-2">Ціна</th><th className="px-4 py-2 text-right">Всього</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewOrder.items.map(item => (
                        <tr key={item.id}><td className="px-4 py-2">{item.productName}</td><td className="px-4 py-2">{item.quantity}</td><td className="px-4 py-2">₴{item.price.toFixed(2)}</td><td className="px-4 py-2 text-right">₴{(item.quantity * item.price * (1 - (item.discount || 0)/100)).toFixed(2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
            <div className="flex justify-end pt-6 space-x-3 border-t">
              <button type="button" onClick={closeModalView} className="bg-white border border-slate-300 py-2 px-4 rounded-lg" disabled={isLoading}>Закрити</button>
              <button onClick={handleUpdateOrderInViewModal} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg" disabled={isLoading || (editableOrderStatus === viewOrder.status && editableOrderNotes === (viewOrder.notes || ''))}>
                {isLoading ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
