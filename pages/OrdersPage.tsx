
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Order, OrderItem, Customer, Product } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, PrinterIcon, FilterIcon, DownloadIcon, ChevronDownIcon } from '../components/Icons';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { logoBase64 } from '../assets/logo';


const orderStatusValues: Order['status'][] = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
const orderStatusTranslations: Record<Order['status'], string> = {
  Pending: 'В очікуванні', Shipped: 'Відправлено', Delivered: 'Доставлено', Cancelled: 'Скасовано',
};
const getStatusColor = (status: Order['status']): string => {
  switch (status) {
    case 'Pending': return 'bg-yellow-100 text-yellow-800';
    case 'Shipped': return 'bg-blue-100 text-blue-800';
    case 'Delivered': return 'bg-green-100 text-green-800';
    case 'Cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-800';
  }
};

const API_BASE_URL = '/api';

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editableOrderStatus, setEditableOrderStatus] = useState<Order['status'] | undefined>(undefined);
  
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [activeOrderData, setActiveOrderData] = useState<Partial<Order> | null>(null);
  const initialNewOrderItem: OrderItem = { productId: '', productName: '', quantity: 1, price: 0, discount: 0 };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isBillOfLadingModalOpen, setIsBillOfLadingModalOpen] = useState(false);
  const [selectedOrderForBoL, setSelectedOrderForBoL] = useState<Order | null>(null);
  const [customerForBoL, setCustomerForBoL] = useState<Customer | null>(null);
  
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [customerForInvoice, setCustomerForInvoice] = useState<Customer | null>(null);

  // Filtering state
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'All'>('All');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('All');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

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


  const fetchAuxiliaryData = useCallback(async () => {
    setIsLoading(true); 
    try {
      const [custRes, prodRes] = await Promise.all([
        fetch(`${API_BASE_URL}/customers`),
        fetch(`${API_BASE_URL}/products`),
      ]);
      if (!custRes.ok) throw new Error(`Failed to fetch customers: ${custRes.statusText}`);
      if (!prodRes.ok) throw new Error(`Failed to fetch products: ${prodRes.statusText}`);
      
      const custData = await custRes.json();
      const prodData = await prodRes.json();
      
      setCustomers(custData || []);
      setAvailableProducts(prodData || []);
    } catch (err: any) {
      console.error("Failed to fetch auxiliary data:", err);
      setPageError(err.message || 'Could not load required data for orders.');
    } finally {
      // setIsLoading(false); // Let fetchOrders handle the final isLoading state
    }
  }, []);
  
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/orders`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch orders' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: Order[] = await response.json();
      setOrders(data);
    } catch (err: any) {
      console.error("Failed to fetch orders:", err);
      setPageError(err.message || 'Could not load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuxiliaryData();
    fetchOrders();
  }, [fetchAuxiliaryData, fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const searchMatch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = filterStatus === 'All' || order.status === filterStatus;
      const customerMatch = filterCustomerId === 'All' || order.customerId === filterCustomerId;
      
      let dateMatch = true;
      if (filterStartDate && filterEndDate) {
        const orderDate = new Date(order.date);
        const startDate = new Date(filterStartDate);
        const endDate = new Date(filterEndDate);
        // Normalize dates to avoid time comparison issues
        orderDate.setHours(0,0,0,0);
        startDate.setHours(0,0,0,0);
        endDate.setHours(0,0,0,0);
        dateMatch = orderDate >= startDate && orderDate <= endDate;
      } else if (filterStartDate) {
        const orderDate = new Date(order.date);
        const startDate = new Date(filterStartDate);
        orderDate.setHours(0,0,0,0);
        startDate.setHours(0,0,0,0);
        dateMatch = orderDate >= startDate;
      } else if (filterEndDate) {
        const orderDate = new Date(order.date);
        const endDate = new Date(filterEndDate);
        orderDate.setHours(0,0,0,0);
        endDate.setHours(0,0,0,0);
        dateMatch = orderDate <= endDate;
      }
      return searchMatch && statusMatch && customerMatch && dateMatch;
    });
  }, [orders, searchTerm, filterStatus, filterCustomerId, filterStartDate, filterEndDate]);

  const resetFilters = () => {
    setFilterStatus('All');
    setFilterCustomerId('All');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchTerm('');
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
      status: activeOrderData.status || 'Pending',
      items: validItems.map(item => ({...item, id: isEditing ? item.id : undefined})),
      totalAmount: totalAmount,
    };

    setIsLoading(true);
    try {
      const url = isEditing && activeOrderData.id ? `${API_BASE_URL}/orders/${activeOrderData.id}` : `${API_BASE_URL}/orders`;
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to ${isEditing ? 'update' : 'create'} order` }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      fetchOrders(); 
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
      setActiveOrderData({ customerId: '', status: 'Pending', items: [{ ...initialNewOrderItem }], totalAmount: 0 });
    } else if (order) {
      // Deep copy items to avoid direct state mutation on edit
      setActiveOrderData({ ...order, items: order.items.map(item => ({ ...item })) });
    }
  };

  const closeOrderModal = () => {
    setModalMode(null);
    setActiveOrderData(null);
  };

  const handleViewOrder = (order: Order) => { setViewOrder(order); setEditableOrderStatus(order.status); };
  
  const handleUpdateOrderStatusInViewModal = async () => {
    if (!viewOrder || !editableOrderStatus || editableOrderStatus === viewOrder.status) return;
    setIsLoading(true); setModalError(null); 
    try {
      const payload = { ...viewOrder, status: editableOrderStatus }; 
      const response = await fetch(`${API_BASE_URL}/orders/${viewOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), 
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update order status' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const updatedOrderFromServer = await response.json();
      setOrders(prevOrders => prevOrders.map(o => o.id === viewOrder.id ? updatedOrderFromServer : o));
      setViewOrder(updatedOrderFromServer); 
    } catch (err: any) {
      console.error("Failed to update order status:", err);
      setModalError(err.message || "Could not update order status.");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModalView = () => { setViewOrder(null); setEditableOrderStatus(undefined); setModalError(null);};

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
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to delete order' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        fetchOrders(); 
      } catch (err: any) {
        console.error("Failed to delete order:", err);
        setPageError(err.message || 'Could not delete order.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-xl font-semibold text-slate-700">Список замовлень</h2>
        <div className="flex space-x-2">
            <button onClick={() => setShowFilters(!showFilters)} aria-label="Показати/сховати фільтри" className="flex items-center bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 px-4 rounded-lg shadow-sm transition-colors">
              <FilterIcon className="w-5 h-5"/>
              <span className="ml-2 hidden sm:inline">Фільтри</span>
            </button>
            <button onClick={() => openOrderModal('add')} aria-label="Додати нове замовлення" className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors w-full sm:w-auto justify-center">
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline ml-2">Додати замовлення</span>
              <span className="sm:hidden ml-2">Додати</span>
            </button>
        </div>
      </div>
       {/* Filter Section */}
      {showFilters && (
        <div className="p-4 bg-white rounded-lg shadow space-y-4 mb-4 border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label htmlFor="filterStatus" className="block text-sm font-medium text-slate-700">Статус</label>
                    <select id="filterStatus" value={filterStatus} onChange={e => setFilterStatus(e.target.value as Order['status'] | 'All')} className="mt-1 block w-full p-2 border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="All">Всі статуси</option>
                        {orderStatusValues.map(status => <option key={status} value={status}>{orderStatusTranslations[status]}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="filterCustomer" className="block text-sm font-medium text-slate-700">Клієнт</label>
                    <select id="filterCustomer" value={filterCustomerId} onChange={e => setFilterCustomerId(e.target.value)} className="mt-1 block w-full p-2 border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="All">Всі клієнти</option>
                        {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="filterStartDate" className="block text-sm font-medium text-slate-700">Дата від</label>
                    <input type="date" id="filterStartDate" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="mt-1 block w-full p-2 border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                </div>
                <div>
                    <label htmlFor="filterEndDate" className="block text-sm font-medium text-slate-700">Дата до</label>
                    <input type="date" id="filterEndDate" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="mt-1 block w-full p-2 border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                </div>
            </div>
            <div className="flex justify-end space-x-2">
                <button onClick={resetFilters} className="text-sm py-2 px-4 bg-slate-500 hover:bg-slate-600 text-white rounded-md shadow-sm">Скинути фільтри</button>
            </div>
        </div>
      )}
      <input type="search" aria-label="Пошук замовлень за ID або ім'ям клієнта" placeholder="Пошук замовлень за ID або ім'ям клієнта..." className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      
      {pageError && <div role="alert" className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{pageError}</div>}
      {isLoading && orders.length === 0 && <div className="text-center p-4">Завантаження замовлень...</div>}

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">ID</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Клієнт</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider hidden sm:table-cell">Дата</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Статус</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider hidden sm:table-cell">Сума</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!isLoading && filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-4 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{order.id.substring(0,8)}...</td>
                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-slate-900">{order.customerName}</td>
                  <td className="px-3 py-4 md:px-6 md:py-4 whitespace-nowrap text-sm text-slate-700 hidden sm:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                  <td className="px-3 py-4 md:px-6 md:py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {orderStatusTranslations[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 md:px-6 md:py-4 whitespace-nowrap text-sm text-slate-700 hidden sm:table-cell">${order.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-4 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium space-x-1">
                    <button onClick={() => handleViewOrder(order)} className="text-sky-600 hover:text-sky-800 transition-colors p-1" aria-label={`Переглянути деталі замовлення ${order.id}`} title="Переглянути"><EyeIcon className="w-5 h-5 inline" /></button>
                    <button onClick={() => openOrderModal('edit', order)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1" aria-label={`Редагувати замовлення ${order.id}`} title="Редагувати"><PencilIcon className="w-5 h-5 inline" /></button>
                    <button onClick={() => openInvoiceModal(order)} className="text-purple-600 hover:text-purple-800 transition-colors p-1" aria-label={`Рахунок для замовлення ${order.id}`} title="Рахунок-фактура"><DocumentTextIcon className="w-5 h-5 inline" /></button>
                    <button onClick={() => openBillOfLadingModal(order)} className="text-teal-600 hover:text-teal-800 transition-colors p-1" aria-label={`Накладна для замовлення ${order.id}`} title="ТТН"><DocumentTextIcon className="w-5 h-5 inline" /></button>
                    <button onClick={() => handleDeleteOrder(order.id)} className="text-red-600 hover:text-red-800 transition-colors p-1" aria-label={`Видалити замовлення ${order.id}`} title="Видалити"><TrashIcon className="w-5 h-5 inline" /></button>
                  </td>
                </tr>
              ))}
               {isLoading && (
                 <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження...</td></tr>
              )}
              {!isLoading && orders.length === 0 && !pageError && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Замовлень ще немає. Натисніть 'Додати нове замовлення', щоб створити.</td></tr>
              )}
              {!isLoading && orders.length > 0 && filteredOrders.length === 0 && (
                 <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Замовлень, що відповідають вашому пошуку та фільтрам, не знайдено.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode && activeOrderData && (
        <div role="dialog" aria-modal="true" aria-labelledby="order-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg md:max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 id="order-modal-title" className="text-xl font-semibold text-slate-800">
                {modalMode === 'add' ? 'Додати нове замовлення' : `Редагувати замовлення: ${activeOrderData.id?.substring(0,8)}...`}
              </h3>
              <button onClick={closeOrderModal} aria-label="Закрити модальне вікно замовлення" className="text-slate-400 hover:text-slate-600" disabled={isLoading}><XMarkIcon className="w-6 h-6"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">{modalError}</div>}
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <label htmlFor="customer" className="block text-sm font-medium text-slate-700">Клієнт <span aria-hidden="true" className="text-red-500">*</span></label>
                {modalMode === 'add' ? (
                  <select id="customer" name="customerId" value={activeOrderData.customerId} onChange={(e) => setActiveOrderData(prev => prev ? { ...prev, customerId: e.target.value } : null)} required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2">
                    <option value="" disabled>Виберіть клієнта</option>
                    {customers.length > 0 ? customers.map(customer => (<option key={customer.id} value={customer.id}>{customer.name} ({customer.email})</option>)) : <option disabled>Клієнти відсутні</option>}
                  </select>
                ) : (
                  <p className="mt-1 text-sm text-slate-600 bg-slate-100 p-2 rounded-md">{activeOrderData.customerName} ({activeOrderData.customerId?.substring(0,8)}...)</p>
                )}
              </div>
              <div>
                <h4 className="text-md font-medium text-slate-700 mb-2">Товари в замовленні <span aria-hidden="true" className="text-red-500">*</span></h4>
                {/* Desktop Headers */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-1 px-2 text-xs font-medium text-slate-500 uppercase">
                    <div className="col-span-4">Назва</div>
                    <div className="col-span-2">Кількість</div>
                    <div className="col-span-2">Ціна</div>
                    <div className="col-span-2">Знижка (%)</div>
                </div>
                {(activeOrderData.items || []).map((item, index) => (
                  <div key={item.id || `item-${index}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3 items-center p-3 border rounded-md bg-slate-50 sm:border-0 sm:p-0 sm:bg-transparent">
                    <div className="sm:col-span-4">
                      <label htmlFor={`product-dropdown-toggle-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Назва</label>
                      <div className="relative" ref={(el) => { productDropdownRefs.current[index] = el; }}>
                          <button
                              type="button"
                              id={`product-dropdown-toggle-${index}`}
                              onClick={() => {
                                  const isOpening = openProductDropdown !== index;
                                  setOpenProductDropdown(isOpening ? index : null);
                                  if (isOpening) {
                                      setProductSearchTerm('');
                                  }
                              }}
                              className="text-left w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none flex justify-between items-center"
                              aria-haspopup="listbox"
                              aria-expanded={openProductDropdown === index}
                          >
                              <span className="truncate">{item.productName || 'Виберіть товар'}</span>
                              <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${openProductDropdown === index ? 'rotate-180' : ''}`} />
                          </button>
  
                          {openProductDropdown === index && (
                              <div className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-slate-200 max-h-60 flex flex-col">
                                  <div className="p-2 border-b border-slate-200">
                                      <input
                                          type="search"
                                          value={productSearchTerm}
                                          onChange={(e) => setProductSearchTerm(e.target.value)}
                                          placeholder="Пошук товару..."
                                          autoFocus
                                          className="w-full p-2 border border-slate-300 rounded-md"
                                      />
                                  </div>
                                  <ul className="py-1 overflow-y-auto" role="listbox">
                                      {(() => {
                                          const filtered = availableProducts
                                              .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()));
  
                                          if (availableProducts.length === 0) {
                                              return <li className="px-4 py-2 text-sm text-slate-500">Товари відсутні</li>;
                                          }
                                          if (filtered.length === 0) {
                                              return <li className="px-4 py-2 text-sm text-slate-500">Товар не знайдено</li>;
                                          }
  
                                          return filtered.map(product => (
                                              <li
                                                  key={product.id}
                                                  onClick={() => {
                                                      handleItemChange(index, 'productIdSelect', product.id);
                                                      setOpenProductDropdown(null);
                                                  }}
                                                  className="px-4 py-2 text-sm text-slate-700 hover:bg-indigo-500 hover:text-white cursor-pointer"
                                                  role="option"
                                                  aria-selected={item.productId === product.id}
                                              >
                                                  {product.name}
                                              </li>
                                          ));
                                      })()}
                                  </ul>
                              </div>
                          )}
                      </div>
                    </div>
                     <div className="sm:col-span-2">
                       <label htmlFor={`quantity-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Кількість</label>
                       <input id={`quantity-${index}`} type="number" placeholder="К-сть" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required aria-required="true" disabled={!item.productId} className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 disabled:bg-slate-100"/>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`price-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Ціна</label>
                      <input id={`price-${index}`} type="number" placeholder="Ціна" min="0" step="0.01" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} required aria-required="true" disabled={!item.productId} className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 disabled:bg-slate-100"/>
                    </div>
                    <div className="sm:col-span-2">
                       <label htmlFor={`discount-${index}`} className="block text-xs font-medium text-slate-700 mb-1 sm:hidden">Знижка (%)</label>
                       <input id={`discount-${index}`} type="number" placeholder="%" min="0" max="100" step="1" value={item.discount || ''} onChange={(e) => handleItemChange(index, 'discount', e.target.value)} disabled={!item.productId} className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 disabled:bg-slate-100"/>
                    </div>
                    <div className="sm:col-span-2 flex justify-end items-center">
                      { (activeOrderData.items || []).length > 1 && <button type="button" onClick={() => removeItem(index)} aria-label={`Видалити товар ${index + 1}`} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="w-5 h-5"/></button> }
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"><PlusIcon className="w-4 h-4 mr-1"/> Додати товар</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-4 border-t">
                <div className="sm:col-span-1">
                  <label htmlFor="status" className="block text-sm font-medium text-slate-700">Статус</label>
                  <select id="status" name="status" value={activeOrderData.status} onChange={(e) => setActiveOrderData(prev => prev ? { ...prev, status: e.target.value as Order['status'] } : null)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2">
                    {orderStatusValues.map(statusValue => (<option key={statusValue} value={statusValue}>{orderStatusTranslations[statusValue]}</option>))}
                  </select>
                </div>
                <div className="sm:col-span-1 text-right">
                  <p className="text-sm font-medium text-slate-700">Загальна сума</p>
                  <p className="text-2xl font-semibold text-slate-800 mt-1">
                      ${calculateTotalAmount(activeOrderData.items).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                 <button type="button" onClick={closeOrderModal} className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors" disabled={isLoading}>Скасувати</button>
                <button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50" disabled={isLoading || !activeOrderData.customerId || (customers.length === 0) || (activeOrderData.items || []).some(item => !item.productId || item.quantity <= 0)}>
                  {isLoading ? 'Збереження...' : (modalMode === 'add' ? 'Зберегти замовлення' : 'Зберегти зміни')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewOrder && (
        <div role="dialog" aria-modal="true" aria-labelledby={`view-order-modal-title-${viewOrder.id}`} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 id={`view-order-modal-title-${viewOrder.id}`} className="text-xl font-semibold text-slate-800">Деталі замовлення: {viewOrder.id.substring(0,8)}...</h3>
              <button onClick={closeModalView} aria-label="Закрити модальне вікно перегляду замовлення" className="text-slate-400 hover:text-slate-600" disabled={isLoading}><XMarkIcon className="w-6 h-6"/></button>
            </div>
             {modalError && <div role="alert" className="mb-4 p-3 bg-red-100 text-red-700 border-red-300 rounded-md text-sm">{modalError}</div>}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><p className="text-sm text-slate-600">Ім'я клієнта</p><p className="font-medium text-slate-800">{viewOrder.customerName}</p></div>
                <div><p className="text-sm text-slate-600">ID Клієнта</p><p className="font-medium text-slate-800">{viewOrder.customerId.substring(0,8)}...</p></div>
                <div><p className="text-sm text-slate-600">Дата замовлення</p><p className="font-medium text-slate-800">{new Date(viewOrder.date).toLocaleDateString()}</p></div>
                <div>
                    <label htmlFor="view-order-status" className="block text-sm text-slate-600">Статус</label>
                    <select id="view-order-status" value={editableOrderStatus} onChange={(e) => setEditableOrderStatus(e.target.value as Order['status'])} className={`mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 font-medium ${getStatusColor(editableOrderStatus || viewOrder.status).replace('bg-', 'text-').replace('-100', '-800')}`}>
                        {orderStatusValues.map(statusValue => (<option key={statusValue} value={statusValue}>{orderStatusTranslations[statusValue]}</option>))}
                    </select>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2 mt-4">Замовлені товари ({viewOrder.items.length}):</p>
                <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md max-h-60 overflow-y-auto">
                  {viewOrder.items.map((item, index) => (
                    <li key={item.id || index} className="p-3 flex justify-between items-center text-sm bg-slate-50 even:bg-white">
                      <div>
                        <p className="font-medium text-slate-800">{item.productName}</p>
                        <p className="text-xs text-slate-600">
                          К-сть: {item.quantity} @ ${item.price.toFixed(2)}
                          {item.discount ? <span className="text-red-500 font-semibold"> (-{item.discount}%)</span> : ''}
                        </p>
                      </div>
                      <p className="text-slate-700 font-medium">${(item.price * item.quantity * (1 - (item.discount || 0) / 100)).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between text-sm">
                      <p className="text-slate-600">Проміжна сума:</p>
                      <p className="font-medium text-slate-800">${(viewOrder.items.reduce((acc, item) => acc + item.price * item.quantity, 0)).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                      <p className="text-slate-600">Загальна знижка:</p>
                      <p className="font-medium text-red-500">-${(viewOrder.items.reduce((acc, item) => acc + (item.price * item.quantity * (item.discount || 0) / 100), 0)).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between text-lg font-semibold mt-2 border-t pt-2">
                      <p className="text-slate-800">Всього:</p>
                      <p className="text-slate-900">${viewOrder.totalAmount.toFixed(2)}</p>
                  </div>
              </div>

            </div>
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
               <button onClick={closeModalView} className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors" disabled={isLoading}>Закрити</button>
              <button onClick={handleUpdateOrderStatusInViewModal} disabled={isLoading || editableOrderStatus === viewOrder.status} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isLoading ? 'Оновлення...' : 'Оновити статус'}
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

  if (!order) return null;
  const shipper = { name: 'ROMANOVA Cosmetics', address: 'вул. Торгова 1, м. Київ, 01001', contact: '+380 (44) 123-45-67' };
  const carrier = { name: 'Global Logistics Inc.', contact: '(555) 987-6543' };
  const calculateApproxWeight = (items: OrderItem[]) => items.reduce((acc, item) => acc + 0.5 + (item.quantity * 0.1), 0).toFixed(1);
  
  const handlePrint = () => { 
    const printableArea = document.getElementById('billOfLadingContent');
    if (printableArea) {
      const printWindow = window.open('', '_blank');
      printWindow?.document.write('<html><head><title>Накладна</title>');
      printWindow?.document.write(`<style> body { margin: 20px; font-family: Arial, sans-serif; font-size: 10pt; color: #333; } .bol-container { border: 1px solid #ccc; padding: 20px; } .bol-header { text-align: center; font-size: 1.5em; font-weight: bold; margin-bottom: 20px; } .bol-section { margin-bottom: 15px; padding: 10px; border: 1px solid #eee; } .bol-section-title { font-weight: bold; margin-bottom: 5px; font-size: 0.9em; text-transform: uppercase; color: #333; } .bol-grid-print { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; } .bol-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; } .bol-table th, .bol-table td { border: 1px solid #ddd; padding: 6px; text-align: left; } .bol-table th { background-color: #f8f8f8; } .signatures-print { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 9pt;} .signatures-print div { margin-top: 20px; } .no-print { display: none !important; } p { margin: 2px 0; color: #333; } @media print { body { color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } p { color: #000 !important; } .bol-grid-print { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 20px !important; } .signatures-print { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 20px !important; } .bol-section-title { color: #000 !important; } } </style>`);
      printWindow?.document.write('</head><body>');
      const contentToPrint = printableArea.cloneNode(true) as HTMLElement;
      // Remove elements not meant for printing (already handled by .print-hidden used on buttons)
      // contentToPrint.querySelectorAll('.print-hidden').forEach(el => el.remove()); 
      printWindow?.document.write(contentToPrint.innerHTML);
      printWindow?.document.write('</body></html>');
      printWindow?.document.close();
      printWindow?.focus();
      setTimeout(() => { printWindow?.print(); }, 500); 
    }
  };

  const handleDownloadPdf = async () => {
    const bolContent = document.getElementById('billOfLadingContent');
    if (!bolContent || !order) return;

    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(bolContent, {
        scale: 2, // Increase scale for better resolution
        useCORS: true, // If any images are from external domains
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      
      // A4 dimensions in mm: 210 x 297
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth - 20; // pdfWidth with some margin
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      
      let currentPosition = 10; // Top margin
      let remainingHeight = imgHeight;

      pdf.addImage(imgData, 'PNG', 10, currentPosition, imgWidth, imgHeight);
      remainingHeight -= (pdfHeight - 20); // Subtract available height on first page (with margins)

      while (remainingHeight > 0) {
        currentPosition = -(pdfHeight - 20 - (imgHeight - remainingHeight)) ; // Negative offset for next part of image
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, currentPosition, imgWidth, imgHeight);
        remainingHeight -= (pdfHeight-20);
      }
      
      pdf.save(`bill_of_lading_${order.id.substring(0,8)}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Не вдалося створити PDF. Будь ласка, спробуйте ще раз.");
    } finally {
        setIsGeneratingPdf(false);
    }
  };


  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bol-modal-title" className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-3xl max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-3 print-hidden">
          <h3 id="bol-modal-title" className="text-lg sm:text-xl font-semibold text-slate-800">Накладна: {order.id.substring(0,8)}...</h3>
          <button onClick={onClose} aria-label="Закрити модальне вікно накладної" className="text-slate-400 hover:text-slate-600" disabled={isGeneratingPdf}><XMarkIcon className="w-6 h-6"/></button>
        </div>
        <div className="overflow-y-auto flex-grow pr-0 sm:pr-2 text-xs sm:text-sm text-slate-700">
          {/* Content to be printed or PDF'd */}
          <div id="billOfLadingContent" className="bol-container p-2 sm:p-4 bg-white"> {/* Ensure bg-white for canvas capture */}
            <div className="bol-header text-base sm:text-lg text-slate-800">ТОВАРНО-ТРАНСПОРТНА НАКЛАДНА</div>
            <div className="text-right mb-4 text-slate-700"><strong>Дата видачі:</strong> {new Date().toLocaleDateString()}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bol-grid-print">
              <div className="bol-section"><div className="bol-section-title text-slate-800">Відправник</div><p><strong>{shipper.name}</strong></p><p>{shipper.address}</p><p>Контакт: {shipper.contact}</p></div>
              <div className="bol-section"><div className="bol-section-title text-slate-800">Одержувач</div>{customer ? (<><p><strong>{customer.name}</strong></p><p>{customer.address?.street}</p><p>{customer.address?.city}, {customer.address?.state} {customer.address?.zip}</p><p>{customer.address?.country}</p><p>Контакт: {customer.phone || customer.email}</p></>) : <p>Дані клієнта недоступні.</p>}</div>
            </div>
            <div className="bol-section mt-4"><div className="bol-section-title text-slate-800">Перевізник</div><p><strong>{carrier.name}</strong></p><p>Контакт: {carrier.contact}</p></div>
            <div className="bol-section mt-4">
              <div className="bol-section-title text-slate-800">Деталі відправлення</div>
              <p><strong>ID Замовлення:</strong> {order.id.substring(0,12)}...</p><p><strong>Дата відправлення:</strong> {new Date(order.date).toLocaleDateString()}</p><p><strong>Кількість місць:</strong> 1 (Партія)</p><p><strong>Загальна вага брутто (прибл.):</strong> {calculateApproxWeight(order.items)} кг</p><p><strong>Загальна вартість замовлення:</strong> ${order.totalAmount.toFixed(2)}</p><p><strong>Оголошена вартість для перевезення:</strong> ${order.totalAmount.toFixed(2)}</p>
              <div className="bol-section-title mt-3 text-slate-800">Опис товарів</div>
              <div className="overflow-x-auto"><table className="bol-table w-full text-slate-700"><thead><tr><th className="text-slate-800">Назва товару</th><th className="text-slate-800">К-сть</th><th className="text-slate-800">Ціна</th><th className="text-slate-800">Всього</th></tr></thead><tbody>
                {order.items.map((item, index) => (<tr key={item.id || index}><td>{item.productName}</td><td className="text-center">{item.quantity}</td><td className="text-right">${item.price.toFixed(2)}</td><td className="text-right">${(item.quantity * item.price).toFixed(2)}</td></tr>))}
              </tbody></table></div>
            </div>
            <div className="bol-section mt-4"><div className="bol-section-title text-slate-800">Особливі вказівки</div><p>Обережно. Стандартна доставка.</p></div>
            <div className="text-xs mt-4 text-slate-600"><p>ОТРИМАНО, відповідно до класифікацій та тарифів...</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 signatures-print"><div><p>Підпис відправника:</p><div className="h-8 border-b border-gray-400 mt-2"></div><p>Дата: _______________</p></div><div><p>Підпис перевізника:</p><div className="h-8 border-b border-gray-400 mt-2"></div><p>Дата: _______________</p></div></div>
            <div className="mt-6 text-center text-xs text-slate-600">Це необоротна накладна.</div>
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t print-hidden">
          <button type="button" onClick={onClose} className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors" disabled={isGeneratingPdf}>Закрити</button>
          <button 
            type="button" 
            onClick={handleDownloadPdf} 
            className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50"
            disabled={isGeneratingPdf}
          >
            <DownloadIcon className="w-5 h-5 mr-2"/> {isGeneratingPdf ? 'Генерація PDF...' : 'Завантажити PDF'}
          </button>
          <button type="button" onClick={handlePrint} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors" disabled={isGeneratingPdf}><PrinterIcon className="w-5 h-5 mr-2"/> Роздрукувати</button>
        </div>
      </div>
    </div>
  );
};

const InvoiceModal: React.FC<DocumentModalProps> = ({ order, customer, onClose }) => {
  if (!order) return null;
  const storeInfo = { name: 'ROMANOVA Cosmetics', address: 'вул. Торгова 1, м. Київ, 01001', phone: '+380 (44) 123-45-67', email: 'sales@romanovacosmetics.com', taxId: 'ІПН 1234567890' };
  
  const handlePrint = () => {
    const printableArea = document.getElementById('invoiceContent');
    if (printableArea) {
      const printWindow = window.open('', '_blank');
      printWindow?.document.write('<html><head><title>Рахунок-фактура</title>');
      // Re-use similar print styles, adjust as needed for invoice specifics
      printWindow?.document.write(`<style> body { margin: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11pt; color: #333; } .invoice-container { border: 1px solid #ddd; padding: 25px; max-width: 800px; margin: auto; background-color: #fff; } .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; } .invoice-header .store-logo { font-size: 2em; font-weight: bold; color: #4A5568; } .invoice-header .invoice-title { text-align: right; } .invoice-title h1 { font-size: 1.8em; color: #2D3748; margin: 0 0 5px 0; } .invoice-title p { margin: 0; font-size: 0.9em; } .invoice-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; font-size: 0.95em; } .invoice-section-title { font-weight: bold; margin-bottom: 8px; font-size: 1em; color: #4A5568; border-bottom: 1px solid #eee; padding-bottom: 4px; } .invoice-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; } .invoice-table th, .invoice-table td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; } .invoice-table th { background-color: #f7fafc; font-weight: 600; } .invoice-table td.number, .invoice-table th.number { text-align: right; } .invoice-totals { margin-top: 30px; text-align: right; } .invoice-totals table { width: auto; margin-left: auto; font-size: 1em; } .invoice-totals td { padding: 8px 10px; } .invoice-totals .grand-total { font-weight: bold; font-size: 1.2em; color: #2D3748; } .invoice-footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #718096; border-top: 1px solid #eee; padding-top: 15px; } .print-hidden { display: none !important; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000 !important; } .invoice-container { border: none; box-shadow: none; } .invoice-header .store-logo, .invoice-title h1, .invoice-section-title, .invoice-totals .grand-total {color: #000 !important;} .invoice-table th {background-color: #f0f0f0 !important;} } </style>`);
      printWindow?.document.write('</head><body>');
      const contentToPrint = printableArea.cloneNode(true) as HTMLElement;
      // contentToPrint.querySelectorAll('.print-hidden').forEach(el => el.remove());
      printWindow?.document.write(contentToPrint.innerHTML);
      printWindow?.document.write('</body></html>');
      printWindow?.document.close();
      printWindow?.focus();
      setTimeout(() => { printWindow?.print(); }, 500);
    }
  };
  
  const subtotal = order.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalDiscount = order.items.reduce((acc, item) => acc + (item.price * item.quantity * (item.discount || 0) / 100), 0);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title" className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-3xl max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-3 print-hidden">
          <h3 id="invoice-modal-title" className="text-lg sm:text-xl font-semibold text-slate-800">Рахунок-фактура: {order.id.substring(0,8)}...</h3>
          <button onClick={onClose} aria-label="Закрити модальне вікно рахунку" className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6"/></button>
        </div>
        <div className="overflow-y-auto flex-grow pr-0 sm:pr-2 text-xs sm:text-sm text-slate-700">
          <div id="invoiceContent" className="invoice-container p-4 sm:p-6 bg-white"> {/* Ensure bg-white for canvas capture */}
            <header className="invoice-header">
              <div>
                <div className="flex items-center space-x-3">
                  <img src={logoBase64} alt="Romanova Cosmetics Logo" className="h-24 w-24" />
                </div>
                <p className="mt-2">{storeInfo.address}</p>
                <p>Телефон: {storeInfo.phone} | Email: {storeInfo.email}</p>
                <p>ІПН: {storeInfo.taxId}</p>
              </div>
              <div className="invoice-title">
                <h1>РАХУНОК-ФАКТУРА</h1>
                <p><strong>Номер:</strong> {order.id.substring(0,12)}...</p>
                <p><strong>Дата:</strong> {new Date(order.date).toLocaleDateString()}</p>
              </div>
            </header>
            <div className="invoice-details-grid">
              <div>
                <div className="invoice-section-title">Платник:</div>
                {customer ? (
                  <>
                    <p><strong>{customer.name}</strong></p>
                    <p>{customer.address?.street}</p>
                    <p>{customer.address?.city}{customer.address?.state && `, ${customer.address.state}`} {customer.address?.zip}</p>
                    <p>{customer.address?.country}</p>
                    <p>Email: {customer.email}</p>
                    {customer.phone && <p>Телефон: {customer.phone}</p>}
                  </>
                ) : <p>Інформація про клієнта відсутня.</p>}
              </div>
              <div>
                <div className="invoice-section-title">Отримувач (Постачальник):</div>
                <p><strong>{storeInfo.name}</strong></p>
                <p>{storeInfo.address}</p>
                <p>ІПН: {storeInfo.taxId}</p>
              </div>
            </div>
            <div className="invoice-section-title">Замовлені товари/послуги:</div>
            <table className="invoice-table w-full">
              <thead><tr><th>#</th><th>Назва товару</th><th className="number">К-сть</th><th className="number">Ціна</th><th className="number">Знижка (%)</th><th className="number">Сума</th></tr></thead>
              <tbody>
                {order.items.map((item, index) => {
                   const itemTotal = item.quantity * item.price;
                   const finalItemTotal = itemTotal * (1 - (item.discount || 0) / 100);
                   return (
                      <tr key={item.id || index}>
                        <td>{index + 1}</td>
                        <td>{item.productName}</td>
                        <td className="number">{item.quantity}</td>
                        <td className="number">${item.price.toFixed(2)}</td>
                        <td className="number">{item.discount || 0}%</td>
                        <td className="number">${finalItemTotal.toFixed(2)}</td>
                      </tr>
                   );
                })}
              </tbody>
            </table>
            <div className="invoice-totals">
              <table>
                <tbody>
                  <tr><td>Проміжна сума:</td><td className="number">${subtotal.toFixed(2)}</td></tr>
                  {totalDiscount > 0 && (
                    <tr>
                      <td>Загальна знижка:</td>
                      <td className="number text-red-500">-${totalDiscount.toFixed(2)}</td>
                    </tr>
                  )}
                  {/* Add Tax/VAT line if applicable */}
                  {/* <tr><td>ПДВ (20%):</td><td className="number">${(order.totalAmount * 0.2).toFixed(2)}</td></tr> */}
                  <tr className="grand-total"><td>До сплати:</td><td className="number">${order.totalAmount.toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>
            <footer className="invoice-footer">
                <p>Дякуємо за ваше замовлення!</p>
                <p>Будь ласка, здійсніть оплату протягом 5 робочих днів.</p>
            </footer>
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t print-hidden">
          <button type="button" onClick={onClose} className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors">Закрити</button>
          {/* Add PDF download for Invoice too if needed, similar to BoL */}
          <button type="button" onClick={handlePrint} className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors"><PrinterIcon className="w-5 h-5 mr-2"/> Роздрукувати</button>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;