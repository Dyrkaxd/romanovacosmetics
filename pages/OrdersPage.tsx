
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Order, OrderItem, Customer, Product, ManagedUser, PaginatedResponse } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, FilterIcon, DownloadIcon, ChevronDownIcon, ShareIcon } from '../components/Icons';
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

  const handleDeleteOrder = async (orderId: string) => {
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

  return (
    <div className="space-y-6">
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
            placeholder="Пошук за ID, ім'ям клієнта..."
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
      {successMessage && <div role="alert" className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">{successMessage}</div>}

      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Клієнт</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden sm:table-cell">Дата</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Статус</th>
                {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider hidden md:table-cell">Менеджер</th>}
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Сума</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Дії</th>
              </tr>
            </thead>
             <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                 <tr><td colSpan={isAdmin ? 7 : 6} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження...</td></tr>
              ) : orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-rose-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-rose-600">#{order.id.substring(0, 6)}...</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{order.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden sm:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600"><StatusPill status={order.status} /></td>
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden md:table-cell">{order.managedByUserEmail || 'N/A'}</td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">₴{order.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                      <button onClick={() => handleViewOrder(order)} className="p-2 rounded-md hover:bg-sky-50 text-slate-500 hover:text-sky-600" title="Переглянути"><EyeIcon className="w-5 h-5"/></button>
                      <button onClick={() => openOrderModal('edit', order)} className="p-2 rounded-md hover:bg-rose-50 text-slate-500 hover:text-rose-600" title="Редагувати"><PencilIcon className="w-5 h-5"/></button>
                      {isAdmin && <button onClick={() => handleShareInvoice(order.id)} className="p-2 rounded-md hover:bg-green-50 text-slate-500 hover:text-green-600" title="Поділитися рахунком"><ShareIcon className="w-5 h-5"/></button>}
                      {isAdmin && <button onClick={() => handleDeleteOrder(order.id)} className="p-2 rounded-md hover:bg-red-50 text-slate-500 hover:text-red-600" title="Видалити"><TrashIcon className="w-5 h-5"/></button>}
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

       {viewOrder && (
         <div role="dialog" aria-modal="true" aria-labelledby="view-order-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <h3 id="view-order-modal-title" className="text-xl font-semibold text-slate-800">Перегляд замовлення #{viewOrder.id.substring(0, 6)}...</h3>
              <button onClick={closeModalView} aria-label="Закрити"><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-6">
              {modalError && <div role="alert" className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{modalError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div><p className="text-sm text-slate-500">Клієнт</p><p className="font-semibold text-slate-800">{viewOrder.customerName}</p></div>
                <div><p className="text-sm text-slate-500">Дата замовлення</p><p className="font-semibold text-slate-800">{new Date(viewOrder.date).toLocaleDateString()}</p></div>
                <div><p className="text-sm text-slate-500">Загальна сума</p><p className="font-semibold text-slate-800">₴{viewOrder.totalAmount.toFixed(2)}</p></div>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50"><tr className="text-left text-xs font-semibold text-slate-500"><th className="px-4 py-2">Товар</th><th className="px-4 py-2">К-сть</th><th className="px-4 py-2">Ціна</th><th className="px-4 py-2">Знижка</th><th className="px-4 py-2 text-right">Всього</th></tr></thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {viewOrder.items.map(item => <tr key={item.id}><td className="px-4 py-2">{item.productName}</td><td className="px-4 py-2">{item.quantity}</td><td className="px-4 py-2">₴{item.price.toFixed(2)}</td><td className="px-4 py-2">{item.discount || 0}%</td><td className="px-4 py-2 text-right font-medium">₴{(item.quantity * item.price * (1-(item.discount || 0)/100)).toFixed(2)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="view-order-status" className="text-sm text-slate-500 block mb-1">Статус замовлення</label>
                  <select id="view-order-status" value={editableOrderStatus} onChange={e => setEditableOrderStatus(e.target.value as Order['status'])} className="w-full p-2 border border-slate-300 rounded-lg">
                    {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="view-order-notes" className="text-sm text-slate-500 block mb-1">Нотатки</label>
                  <textarea id="view-order-notes" value={editableOrderNotes} onChange={e => setEditableOrderNotes(e.target.value)} rows={3} className="w-full p-2 border border-slate-300 rounded-lg"></textarea>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center pt-6 mt-6 border-t border-slate-200">
                <div className="flex space-x-2">
                    <button onClick={() => window.open(`${window.location.origin}/#/invoice/${viewOrder.id}`, '_blank')} className="flex items-center text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-lg"><DocumentTextIcon className="w-4 h-4 mr-1.5"/>Рахунок</button>
                    <button onClick={() => window.open(`${window.location.origin}/#/bill-of-lading/${viewOrder.id}`, '_blank')} className="flex items-center text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-lg"><DownloadIcon className="w-4 h-4 mr-1.5"/>ТТН</button>
                </div>
                <div className="flex space-x-3 mt-4 sm:mt-0">
                    <button onClick={closeModalView} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg">Закрити</button>
                    <button onClick={handleUpdateOrderInViewModal} disabled={isLoading} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">{isLoading ? 'Збереження...' : 'Зберегти зміни'}</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {modalMode && (
        <div role="dialog" aria-modal="true" aria-labelledby="order-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200">
                    <h3 id="order-modal-title" className="text-xl font-semibold text-slate-800">{modalMode === 'edit' ? 'Редагувати замовлення' : 'Створити нове замовлення'}</h3>
                    <button onClick={closeOrderModal} aria-label="Закрити" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
                </div>
                {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{modalError}</div>}
                <form onSubmit={handleSubmitOrder} className="flex-grow overflow-y-auto pr-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="customer" className="block text-sm font-medium text-slate-700 mb-1">Клієнт</label>
                        <select id="customer" value={activeOrderData?.customerId || ''} onChange={e => setActiveOrderData(p => ({...p, customerId: e.target.value}))} required className="w-full p-2.5 border border-slate-300 rounded-lg">
                            <option value="">-- Виберіть клієнта --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                        <select id="status" value={activeOrderData?.status || 'Ordered'} onChange={e => setActiveOrderData(p => ({...p, status: e.target.value as Order['status']}))} required className="w-full p-2.5 border border-slate-300 rounded-lg">
                            {orderStatusValues.map(s => <option key={s} value={s}>{orderStatusTranslations[s]}</option>)}
                        </select>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-md font-semibold text-slate-700 pt-4 border-t">Товари в замовленні</h4>
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 pb-1">
                      <div className="col-span-5"><label className="text-xs font-semibold text-slate-500">Товар</label></div>
                      <div className="col-span-2"><label className="text-xs font-semibold text-slate-500">Кількість</label></div>
                      <div className="col-span-2"><label className="text-xs font-semibold text-slate-500">Ціна</label></div>
                      <div className="col-span-2"><label className="text-xs font-semibold text-slate-500">Знижка, %</label></div>
                      <div className="col-span-1 flex justify-end"><label className="text-xs font-semibold text-slate-500">Дія</label></div>
                    </div>
                    {(activeOrderData?.items || []).map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50 border">
                        <div className="col-span-12 md:col-span-5 relative" ref={el => { productDropdownRefs.current[index] = el; }}>
                           <input type="text" placeholder="Почніть вводити назву товару"
                                value={openProductDropdown === index ? productSearchTerm : item.productName}
                                onFocus={() => { setOpenProductDropdown(index); setProductSearchTerm(''); }}
                                onChange={(e) => {
                                  setProductSearchTerm(e.target.value);
                                  handleItemChange(index, 'productName', e.target.value);
                                }}
                                className="w-full p-2 border border-slate-300 rounded-md"
                            />
                            {openProductDropdown === index && (
                                <div className="absolute top-full left-0 w-full bg-white border border-slate-300 rounded-b-md shadow-lg z-10 max-h-48 overflow-y-auto">
                                  {filteredProducts.map(p => (
                                      <div key={p.id} 
                                          onClick={() => {
                                              handleItemChange(index, 'productIdSelect', p.id);
                                              setOpenProductDropdown(null);
                                          }}
                                          className="p-2 hover:bg-rose-50 cursor-pointer text-sm">
                                        {p.name}
                                      </div>
                                  ))}
                                  {filteredProducts.length === 0 && <div className="p-2 text-sm text-slate-500">Товар не знайдено</div>}
                                </div>
                            )}
                        </div>
                        <div className="col-span-4 md:col-span-2"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" placeholder="К-сть"/></div>
                        <div className="col-span-4 md:col-span-2"><input type="number" step="0.01" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" placeholder="Ціна"/></div>
                        <div className="col-span-4 md:col-span-2"><input type="number" step="0.01" value={item.discount || ''} onChange={e => handleItemChange(index, 'discount', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md" placeholder="Знижка %"/></div>
                        <div className="col-span-12 md:col-span-1 flex justify-end"><button type="button" onClick={() => removeItem(index)}><TrashIcon className="w-5 h-5 text-red-500 hover:text-red-700"/></button></div>
                      </div>
                    ))}
                     <button type="button" onClick={addItem} className="text-sm font-semibold text-rose-600 hover:underline">+ Додати товар</button>
                  </div>
                   <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">Нотатки</label>
                        <textarea id="notes" value={activeOrderData?.notes || ''} onChange={e => setActiveOrderData(p => ({...p, notes: e.target.value}))} rows={3} className="w-full p-2.5 border border-slate-300 rounded-lg"></textarea>
                    </div>

                    <div className="text-right font-bold text-lg text-slate-800 pt-4 border-t">Всього: ₴{calculateTotalAmount(activeOrderData?.items).toFixed(2)}</div>
                    
                    <div className="flex flex-col sm:flex-row justify-end pt-6 space-y-2 sm:space-y-0 sm:space-x-3 border-t border-slate-200">
                        <button type="button" onClick={closeOrderModal} disabled={isLoading} className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg">Скасувати</button>
                        <button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">{isLoading ? 'Збереження...' : 'Зберегти замовлення'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;