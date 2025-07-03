
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Order, OrderItem, Customer, Product, ManagedUser, PaginatedResponse } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, FilterIcon, DownloadIcon, ChevronDownIcon, ShareIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import { Database } from '../types/supabase';
import Pagination from '../components/Pagination';
import { generateInvoicePdf, generateBillOfLadingPdf } from '../utils/pdfUtils';
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

  const [isBillOfLadingModalOpen, setIsBillOfLadingModalOpen] = useState(false);
  const [selectedOrderForBoL, setSelectedOrderForBoL] = useState<Order | null>(null);
  const [customerForBoL, setCustomerForBoL] = useState<Customer | null>(null);
  
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [customerForInvoice, setCustomerForInvoice] = useState<Customer | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openProductDropdown !== null && productDropdownRefs.current[openProductDropdown] && !productDropdownRefs.current[openProductDropdown]!.contains(event.target as Node)) {
        setOpenProductDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openProductDropdown]);

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
  }, [pageSize, searchTerm, filterStatus, filterCustomerId, filterManagerEmail, filterStartDate, filterEndDate, fetchOrders]);


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

  const openBillOfLadingModal = (order: Order) => {
    const customerDetail = customers.find(c => c.id === order.customerId);
    setSelectedOrderForBoL(order); setCustomerForBoL(customerDetail || null); setIsBillOfLadingModalOpen(true);
  };
  const closeBillOfLadingModal = () => { setIsBillOfLadingModalOpen(false); setSelectedOrderForBoL(null); setCustomerForBoL(null);};

  const openInvoiceModal = (order: Order) => {
    const customerDetail = customers.find(c => c.id === order.customerId);
    setSelectedOrderForInvoice(order); setCustomerForInvoice(customerDetail || null); setIsInvoiceModalOpen(true);
  };
  const closeInvoiceModal = () => { setIsInvoiceModalOpen(false); setSelectedOrderForInvoice(null); setCustomerForInvoice(null);};


  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('Ви впевнені, що хочете видалити це замовлення? Цю дію неможливо скасувати.')) {
      setIsLoading(true); setPageError(null);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 204) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to delete order' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const newTotalCount = totalCount - 1;
        const newTotalPages = Math.ceil(newTotalCount / pageSize);
        const newCurrentPage = (currentPage > newTotalPages && newTotalPages > 0) ? newTotalPages : currentPage;
        fetchOrders(newCurrentPage);
      } catch (err: any) {
        console.error("Failed to delete order:", err);
        setPageError(err.message || 'Could not delete order.');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleShareInvoice = (orderId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/invoice/${orderId}`;
    navigator.clipboard.writeText(url).then(() => {
        setSuccessMessage('Посилання на рахунок скопійовано в буфер обміну!');
    }, (err) => {
        console.error('Could not copy text: ', err);
        setPageError('Не вдалося скопіювати посилання.');
    });
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div role="status" className="fixed top-5 right-5 z-50 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out">
          {successMessage}
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Замовлення</h2>
        <div className="flex items-center space-x-2">
            <button onClick={() => setShowFilters(!showFilters)} aria-label="Показати/сховати фільтри" className="flex items-center bg-white hover:bg-slate-100 text-slate-600 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors border border-slate-300">
              <FilterIcon className="w-5 h-5"/>
              <span className="ml-2 hidden sm:inline">Фільтри</span>
            </button>
            <button onClick={() => openOrderModal('add')} aria-label="Додати нове замовлення" className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">
              <PlusIcon className="w-5 h-5" />
              <span className="ml-2">Створити замовлення</span>
            </button>
        </div>
      </div>
       {/* Filter Section */}
      {showFilters && (
        <div className="p-4 bg-white rounded-lg shadow-sm space-y-4 border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                    <label htmlFor="filterStatus" className="block text-sm font-medium text-slate-700">Статус</label>
                    <select id="filterStatus" value={filterStatus} onChange={e => {setFilterStatus(e.target.value as Order['status'] | 'All'); setCurrentPage(1);}} className="mt-1 block w-full p-2 border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm">
                        <option value="All">Всі статуси</option>
                        {orderStatusValues.map(status => <option key={status} value={status}>{orderStatusTranslations[status]}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="filterCustomer" className="block text-sm font-medium text-slate-700">Клієнт</label>
                    <select id="filterCustomer" value={filterCustomerId} onChange={e => {setFilterCustomerId(e.target.value); setCurrentPage(1);}} className="mt-1 block w-full p-2 border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm">
                        <option value="All">Всі клієнти</option>
                        {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    </select>
                </div>
                <div>
                  <label htmlFor="filterManager" className="block text-sm font-medium text-slate-700">Менеджер</label>
                  <select id="filterManager" value={filterManagerEmail} onChange={e => {setFilterManagerEmail(e.target.value); setCurrentPage(1);}} className="mt-1 block w-full p-2 border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm">
                    <option value="All">Всі менеджери</option>
                    {allOrderManagers.map(manager => <option key={manager.email} value={manager.email}>{manager.name || manager.email}</option>)}
                  </select>
                </div>
                <div>
                    <label htmlFor="filterStartDate" className="block text-sm font-medium text-slate-700">Дата від</label>
                    <input type="date" id="filterStartDate" value={filterStartDate} onChange={e => {setFilterStartDate(e.target.value); setCurrentPage(1);}} className="mt-1 block w-full p-2 border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="filterEndDate" className="block text-sm font-medium text-slate-700">Дата до</label>
                    <input type="date" id="filterEndDate" value={filterEndDate} onChange={e => {setFilterEndDate(e.target.value); setCurrentPage(1);}} className="mt-1 block w-full p-2 border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm"/>
                </div>
            </div>
            <div className="flex justify-end space-x-2">
                <button onClick={resetFilters} className="text-sm py-2 px-4 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-md shadow-sm">Скинути фільтри</button>
            </div>
        </div>
      )}
      <input type="search" aria-label="Пошук замовлень за ID або ім'ям клієнта" placeholder="Пошук за ID, ім'ям клієнта..." className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} />
      
      {pageError && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{pageError}</div>}
      
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Клієнт</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden sm:table-cell">Дата</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Статус</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden sm:table-cell">Сума</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                 <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження...</td></tr>
              ) : orders.length > 0 ? (orders.map((order) => (
                <tr key={order.id} className="hover:bg-rose-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-rose-600">#{order.id.substring(0,6)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{order.customerName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden sm:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusPill status={order.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium hidden sm:table-cell">₴{order.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                    <button onClick={() => handleViewOrder(order)} className="text-slate-500 hover:text-sky-600 transition-colors p-2 rounded-md hover:bg-sky-50" aria-label={`Переглянути деталі замовлення ${order.id}`} title="Переглянути"><EyeIcon className="w-5 h-5" /></button>
                    <button onClick={() => openOrderModal('edit', order)} className="text-slate-500 hover:text-rose-600 transition-colors p-2 rounded-md hover:bg-rose-50" aria-label={`Редагувати замовлення ${order.id}`} title="Редагувати"><PencilIcon className="w-5 h-5" /></button>
                    <button onClick={() => openInvoiceModal(order)} className="text-slate-500 hover:text-purple-600 transition-colors p-2 rounded-md hover:bg-purple-50" aria-label={`Рахунок для замовлення ${order.id}`} title="Рахунок-фактура"><DocumentTextIcon className="w-5 h-5" /></button>
                    <button onClick={() => handleShareInvoice(order.id)} className="text-slate-500 hover:text-teal-600 transition-colors p-2 rounded-md hover:bg-teal-50" aria-label={`Поділитися рахунком для замовлення ${order.id}`} title="Поділитися рахунком"><ShareIcon className="w-5 h-5" /></button>
                    <button onClick={() => handleDeleteOrder(order.id)} className="text-slate-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50" aria-label={`Видалити замовлення ${order.id}`} title="Видалити"><TrashIcon className="w-5 h-5" /></button>
                  </td>
                </tr>
              ))) : (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                  {!pageError && (totalCount === 0 && searchTerm === '' ? "Замовлень ще немає. Натисніть 'Створити замовлення', щоб почати." : "Замовлень, що відповідають вашому пошуку та фільтрам, не знайдено.")}
                </td></tr>
              )}
            </tbody>
          </table>
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

      {modalMode && activeOrderData && (
        <div role="dialog" aria-modal="true" aria-labelledby="order-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg md:max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200">
              <h3 id="order-modal-title" className="text-xl font-semibold text-slate-800">
                {modalMode === 'add' ? 'Створити нове замовлення' : `Редагувати замовлення: #${activeOrderData.id?.substring(0,6)}`}
              </h3>
              <button onClick={closeOrderModal} aria-label="Закрити модальне вікно замовлення" className="text-slate-400 hover:text-slate-600" disabled={isLoading}><XMarkIcon className="w-6 h-6"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{modalError}</div>}
            <form onSubmit={handleSubmitOrder} className="space-y-6 overflow-y-auto pr-2 flex-grow">
              <div>
                <label htmlFor="customer" className="block text-sm font-medium text-slate-700 mb-1">Клієнт <span aria-hidden="true" className="text-red-500">*</span></label>
                {modalMode === 'add' ? (
                  <select id="customer" name="customerId" value={activeOrderData.customerId || ''} onChange={(e) => setActiveOrderData(prev => prev ? { ...prev, customerId: e.target.value } : null)} required aria-required="true" className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5">
                    <option value="" disabled>Виберіть клієнта</option>
                    {customers.length > 0 ? customers.map(customer => (<option key={customer.id} value={customer.id}>{customer.name} ({customer.email})</option>)) : <option disabled>Клієнти відсутні</option>}
                  </select>
                ) : (
                  <p className="mt-1 text-base text-slate-800 font-medium bg-slate-100 p-2.5 rounded-lg">{activeOrderData.customerName}</p>
                )}
              </div>
              <div>
                <h4 className="text-md font-medium text-slate-700 mb-2">Товари в замовленні <span aria-hidden="true" className="text-red-500">*</span></h4>
                <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-1 px-2 text-xs font-semibold text-slate-500">
                    <div className="col-span-4">Назва</div>
                    <div className="col-span-2">Кількість</div>
                    <div className="col-span-2">Ціна</div>
                    <div className="col-span-2">Знижка (%)</div>
                </div>
                {(activeOrderData.items || []).map((item, index) => (
                  <div key={item.id || `item-${index}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3 items-center p-3 border rounded-lg bg-slate-50/75 sm:border-0 sm:p-0 sm:bg-transparent">
                    <div className="sm:col-span-4">
                      <label htmlFor={`product-dropdown-toggle-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Назва</label>
                      <div className="relative" ref={(el) => { productDropdownRefs.current[index] = el; }}>
                          <button
                              type="button"
                              id={`product-dropdown-toggle-${index}`}
                              onClick={() => {
                                  const isOpening = openProductDropdown !== index;
                                  setOpenProductDropdown(isOpening ? index : null);
                                  if (isOpening) setProductSearchTerm('');
                              }}
                              className="text-left w-full border-slate-300 rounded-lg shadow-sm sm:text-sm p-2.5 bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none flex justify-between items-center"
                              aria-haspopup="listbox"
                              aria-expanded={openProductDropdown === index}
                          >
                              <span className="truncate">{item.productName || 'Виберіть товар'}</span>
                              <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${openProductDropdown === index ? 'rotate-180' : ''}`} />
                          </button>
  
                          {openProductDropdown === index && (
                              <div className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-slate-200 max-h-60 flex flex-col">
                                  <div className="p-2 border-b border-slate-200">
                                      <input type="search" value={productSearchTerm} onChange={(e) => setProductSearchTerm(e.target.value)} placeholder="Пошук товару..." autoFocus className="w-full p-2 border border-slate-300 rounded-md" />
                                  </div>
                                  <ul className="py-1 overflow-y-auto" role="listbox">
                                      {(() => {
                                          const filtered = availableProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()));
                                          if (filtered.length === 0) return <li className="px-4 py-2 text-sm text-slate-500">{availableProducts.length === 0 ? 'Товари відсутні' : 'Товар не знайдено'}</li>;
                                          return filtered.map(product => (<li key={product.id} onClick={() => { handleItemChange(index, 'productIdSelect', product.id); setOpenProductDropdown(null); }} className="px-4 py-2 text-sm text-slate-700 hover:bg-rose-500 hover:text-white cursor-pointer" role="option" aria-selected={item.productId === product.id}>{product.name}</li>));
                                      })()}
                                  </ul>
                              </div>
                          )}
                      </div>
                    </div>
                     <div className="sm:col-span-2">
                       <label htmlFor={`quantity-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Кількість</label>
                       <input id={`quantity-${index}`} type="number" placeholder="К-сть" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required aria-required="true" disabled={!item.productId} className="block w-full border-slate-300 rounded-lg shadow-sm sm:text-sm p-2.5 disabled:bg-slate-100"/>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`price-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Ціна</label>
                      <input id={`price-${index}`} type="number" placeholder="Ціна" min="0" step="0.01" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} required aria-required="true" disabled={!item.productId} className="block w-full border-slate-300 rounded-lg shadow-sm sm:text-sm p-2.5 disabled:bg-slate-100"/>
                    </div>
                    <div className="sm:col-span-2">
                       <label htmlFor={`discount-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Знижка (%)</label>
                       <input id={`discount-${index}`} type="number" placeholder="%" min="0" max="100" step="1" value={item.discount || ''} onChange={(e) => handleItemChange(index, 'discount', e.target.value)} disabled={!item.productId} className="block w-full border-slate-300 rounded-lg shadow-sm sm:text-sm p-2.5 disabled:bg-slate-100"/>
                    </div>
                    <div className="sm:col-span-2 flex justify-end items-center">
                      <button type="button" onClick={() => removeItem(index)} aria-label={`Видалити товар ${index + 1}`} className="text-slate-400 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="text-sm text-rose-600 hover:text-rose-700 font-semibold flex items-center"><PlusIcon className="w-4 h-4 mr-1"/> Додати товар</button>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">Коментарі до замовлення</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={activeOrderData.notes || ''}
                  onChange={(e) => setActiveOrderData(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5"
                  placeholder="Внутрішні нотатки, особливі інструкції тощо."
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-4">
                <div className="sm:col-span-1">
                  <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                  <select id="status" name="status" value={activeOrderData.status} onChange={(e) => setActiveOrderData(prev => prev ? { ...prev, status: e.target.value as Order['status'] } : null)} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5">
                    {orderStatusValues.map(statusValue => (<option key={statusValue} value={statusValue}>{orderStatusTranslations[statusValue]}</option>))}
                  </select>
                </div>
                <div className="sm:col-span-1 text-right">
                  <p className="text-sm font-medium text-slate-700">Загальна сума</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">
                      ₴{calculateTotalAmount(activeOrderData.items).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-6 border-t border-slate-200">
                 <button type="button" onClick={closeOrderModal} className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors" disabled={isLoading}>Скасувати</button>
                <button type="submit" className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50" disabled={isLoading || !activeOrderData.customerId || (customers.length === 0) || (activeOrderData.items || []).some(item => !item.productId || item.quantity <= 0)}>
                  {isLoading ? 'Збереження...' : (modalMode === 'add' ? 'Зберегти замовлення' : 'Зберегти зміни')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewOrder && (
        <div role="dialog" aria-modal="true" aria-labelledby={`view-order-modal-title-${viewOrder.id}`} className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md md:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
              <h3 id={`view-order-modal-title-${viewOrder.id}`} className="text-xl font-semibold text-slate-800">Деталі: #{viewOrder.id.substring(0,6)}</h3>
              <button onClick={closeModalView} aria-label="Закрити модальне вікно перегляду замовлення" className="text-slate-400 hover:text-slate-600" disabled={isLoading}><XMarkIcon className="w-6 h-6"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{modalError}</div>}
            <div className="space-y-4 overflow-y-auto pr-2 flex-grow">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div><p className="text-sm text-slate-500">Ім'я клієнта</p><p className="font-semibold text-slate-800 text-base">{viewOrder.customerName}</p></div>
                <div><p className="text-sm text-slate-500">Дата замовлення</p><p className="font-semibold text-slate-800 text-base">{new Date(viewOrder.date).toLocaleDateString()}</p></div>
              </div>
              <div>
                    <label htmlFor="view-order-status" className="block text-sm text-slate-500">Статус</label>
                    <select id="view-order-status" value={editableOrderStatus} onChange={(e) => setEditableOrderStatus(e.target.value as Order['status'])} className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5 font-semibold">
                        {orderStatusValues.map(statusValue => (<option key={statusValue} value={statusValue}>{orderStatusTranslations[statusValue]}</option>))}
                    </select>
              </div>
              <div>
                <label htmlFor="view-order-notes" className="block text-sm text-slate-500">Коментарі</label>
                <textarea
                  id="view-order-notes"
                  rows={3}
                  value={editableOrderNotes}
                  onChange={(e) => setEditableOrderNotes(e.target.value)}
                  className="mt-1 block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5"
                  placeholder="Коментарі до замовлення відсутні"
                ></textarea>
              </div>
              
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2 mt-4">Замовлені товари ({viewOrder.items.length}):</p>
                <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                  {viewOrder.items.map((item, index) => (
                    <li key={item.id || index} className="p-3 flex justify-between items-center text-sm bg-slate-50/50 even:bg-white">
                      <div>
                        <p className="font-medium text-slate-800">{item.productName}</p>
                        <p className="text-xs text-slate-600">
                          К-сть: {item.quantity} @ ₴{item.price.toFixed(2)}
                          {item.discount ? <span className="text-red-500 font-semibold"> (-{item.discount}%)</span> : ''}
                        </p>
                      </div>
                      <p className="text-slate-700 font-medium">₴{(item.price * item.quantity * (1 - (item.discount || 0) / 100)).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex justify-between text-sm">
                      <p className="text-slate-600">Проміжна сума:</p>
                      <p className="font-medium text-slate-800">₴{(viewOrder.items.reduce((acc, item) => acc + item.price * item.quantity, 0)).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                      <p className="text-slate-600">Загальна знижка:</p>
                      <p className="font-medium text-red-500">-₴{(viewOrder.items.reduce((acc, item) => acc + (item.price * item.quantity * (item.discount || 0) / 100), 0)).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between text-lg font-bold mt-2 border-t pt-2">
                      <p className="text-slate-800">Всього:</p>
                      <p className="text-slate-900">₴{viewOrder.totalAmount.toFixed(2)}</p>
                  </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
              <button onClick={closeModalView} className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors" disabled={isLoading}>Закрити</button>
              <button
                onClick={handleUpdateOrderInViewModal}
                disabled={isLoading || (editableOrderStatus === viewOrder.status && editableOrderNotes === (viewOrder.notes || ''))}
                className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBillOfLadingModalOpen && selectedOrderForBoL && (<BillOfLadingModal order={selectedOrderForBoL} customer={customerForBoL} onClose={closeBillOfLadingModal}/>)}
      {isInvoiceModalOpen && selectedOrderForInvoice && (<InvoiceModal order={selectedOrderForInvoice} customer={customerForInvoice} onClose={closeInvoiceModal} />)}
    </div>
  );
};

interface DocumentModalProps { order: Order | null; customer: Customer | null; onClose: () => void; }

const BillOfLadingModal: React.FC<DocumentModalProps> = ({ order, customer, onClose }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!order || !customer) return null;

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
        await generateBillOfLadingPdf(order, customer);
    } catch (error) {
        console.error("Failed to generate PDF for Bill of Lading:", error);
        alert('Не вдалося створити PDF. Будь ласка, спробуйте ще раз.');
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-slate-800">Товарно-транспортна накладна (ТТН)</h3>
            <button onClick={onClose} aria-label="Закрити" disabled={isGeneratingPdf}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
        </div>
        <p className="mt-2 text-slate-600">Сформувати та завантажити ТТН для замовлення <span className="font-bold">#{order.id.substring(0, 6)}</span>?</p>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} disabled={isGeneratingPdf} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">Скасувати</button>
          <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center">
            <DownloadIcon className="w-5 h-5 mr-2" />
            {isGeneratingPdf ? 'Створення PDF...' : 'Завантажити PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

const InvoiceModal: React.FC<DocumentModalProps> = ({ order, customer, onClose }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    if (!order || !customer) return null;

    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        try {
            await generateInvoicePdf(order, customer);
        } catch (error) {
            console.error("Failed to generate PDF for Invoice:", error);
            alert('Не вдалося створити PDF. Будь ласка, спробуйте ще раз.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
       <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-slate-800">Рахунок-фактура</h3>
            <button onClick={onClose} aria-label="Закрити" disabled={isGeneratingPdf}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
        </div>
        <p className="mt-2 text-slate-600">Сформувати та завантажити рахунок для замовлення <span className="font-bold">#{order.id.substring(0, 6)}</span>?</p>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} disabled={isGeneratingPdf} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">Скасувати</button>
          <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center">
             <DownloadIcon className="w-5 h-5 mr-2" />
            {isGeneratingPdf ? 'Створення PDF...' : 'Завантажити PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};


export default OrdersPage;
