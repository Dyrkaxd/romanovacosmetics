
import React, { useState, useEffect, useCallback } from 'react';
import { Order, OrderItem, Customer, Product } from '../types';
import { EyeIcon, XMarkIcon, PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon, PrinterIcon } from '../components/Icons';

// Fallback customers data if localStorage is empty or fails
const mockCustomersData: Customer[] = [
  { id: 'CUST001', name: 'Аліса Чудесенко (Резерв)', email: 'alice@example.com', phone: '555-0101', address: { street: '123 Fantasy Lane', city: 'Wonderland', state: 'CA', zip: '90210', country: 'USA' }, joinDate: '2023-01-15' },
  { id: 'CUST002', name: 'Богдан Будівельник (Резерв)', email: 'bob@example.com', phone: '555-0102', address: { street: '456 Construction Rd', city: 'Builderville', state: 'NY', zip: '10001', country: 'USA' }, joinDate: '2023-02-20' },
];

const CUSTOMERS_STORAGE_KEY = 'ecomDashCustomers';
const PRODUCTS_STORAGE_KEY = 'ecomDashProducts'; // Key for products
const ORDERS_STORAGE_KEY = 'ecomDashOrders';

const initialOrdersData: Order[] = [
  { id: 'ORD001', customerId: 'CUST001', customerName: 'Аліса Чудесенко', date: '2024-07-20', status: 'Shipped', totalAmount: 125.50, items: [{productId: 'PROD001', productName: 'Бездротова ергономічна миша', quantity: 1, price: 49.99}, {productId: 'X1', productName: 'USB-концентратор', quantity:1, price: 25.52}, {productId: 'X2', productName: 'Килимок для миші', quantity:2, price: 25.00}] },
  { id: 'ORD002', customerId: 'CUST002', customerName: 'Богдан Будівельник', date: '2024-07-19', status: 'Pending', totalAmount: 75.00, items: [{productId: 'PROD002', productName: 'Органічний зелений чай', quantity: 3, price: 12.50}, {productId: 'Y1', productName: 'Заварник для чаю', quantity:1, price: 10.00}] },
  { id: 'ORD003', customerId: 'CUST003', customerName: 'Чарлі Браун', date: '2024-07-18', status: 'Delivered', totalAmount: 210.00, items: [{productId: 'PROD003', productName: 'Сучасна книжкова полиця', quantity: 1, price: 199.00}, {productId: 'Z1', productName: 'Підставки для книг', quantity:1, price: 11.00}] },
  { id: 'ORD004', customerId: 'CUST004', customerName: 'Діана Прінс', date: '2024-07-21', status: 'Cancelled', totalAmount: 50.00, items: [{productId: 'Z2', productName: 'Подарункова картка', quantity: 1, price: 50.00}] },
];

const orderStatusValues: Order['status'][] = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

const orderStatusTranslations: Record<Order['status'], string> = {
  Pending: 'В очікуванні',
  Shipped: 'Відправлено',
  Delivered: 'Доставлено',
  Cancelled: 'Скасовано',
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

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(() => {
    const storedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (storedOrders) {
      try {
        const parsedOrders = JSON.parse(storedOrders);
        return parsedOrders.length > 0 ? parsedOrders : initialOrdersData;
      } catch (e) {
        console.error("Помилка розбору замовлень з localStorage", e);
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(initialOrdersData));
        return initialOrdersData;
      }
    }
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(initialOrdersData));
    return initialOrdersData;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editableOrderStatus, setEditableOrderStatus] = useState<Order['status'] | undefined>(undefined);
  
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  
  const initialNewOrderItem: OrderItem = { productId: '', productName: '', quantity: 1, price: 0 };
  
  const [newOrderData, setNewOrderData] = useState<Partial<Order>>({
    customerId: '',
    status: 'Pending',
    items: [{ ...initialNewOrderItem }],
  });

  const [currentOrderData, setCurrentOrderData] = useState<Partial<Order>>({});
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  const [isBillOfLadingModalOpen, setIsBillOfLadingModalOpen] = useState(false);
  const [selectedOrderForBoL, setSelectedOrderForBoL] = useState<Order | null>(null);
  const [customerForBoL, setCustomerForBoL] = useState<Customer | null>(null);


  const loadAuxiliaryData = useCallback(() => {
    const storedCustomers = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (storedCustomers) {
      try {
        const parsedCustomers = JSON.parse(storedCustomers);
        setCustomers(parsedCustomers.length > 0 ? parsedCustomers : mockCustomersData);
      } catch (error) {
        console.error("Помилка розбору клієнтів з localStorage:", error);
        setCustomers(mockCustomersData);
      }
    } else {
      setCustomers(mockCustomersData);
    }

    const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (storedProducts) {
      try {
        // Ensure products loaded don't expect 'stock'
        const parsedProducts = JSON.parse(storedProducts).map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          description: p.description,
          imageUrl: p.imageUrl
        }));
        setAvailableProducts(parsedProducts);
      } catch (error) {
        console.error("Помилка розбору товарів з localStorage:", error);
        setAvailableProducts([]);
      }
    } else {
      setAvailableProducts([]);
    }
  }, []);
  
  useEffect(() => {
    loadAuxiliaryData();
  }, [loadAuxiliaryData]);
  
  useEffect(() => {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === CUSTOMERS_STORAGE_KEY && event.newValue) {
        try {
          const updatedCustomers = JSON.parse(event.newValue);
          setCustomers(updatedCustomers.length > 0 ? updatedCustomers : mockCustomersData);
        } catch (error) { console.error("Помилка оновлення клієнтів з події сховища:", error); }
      }
      if (event.key === PRODUCTS_STORAGE_KEY && event.newValue) {
         try {
           const updatedProducts = JSON.parse(event.newValue).map((p: any) => ({
              id: p.id, name: p.name, category: p.category, price: p.price, description: p.description, imageUrl: p.imageUrl
           }));
          setAvailableProducts(updatedProducts);
        } catch (error) { console.error("Помилка оновлення товарів з події сховища:", error); }
      }
       if (event.key === ORDERS_STORAGE_KEY && event.newValue) {
        try {
          const updatedOrders = JSON.parse(event.newValue);
          setOrders(updatedOrders);
        } catch (error) { console.error("Помилка оновлення замовлень з події сховища:", error); }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  const calculateTotalAmount = (items: OrderItem[] = []): number => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.price)), 0);
  };

  const handleItemChange = (
    index: number, 
    field: keyof OrderItem | 'productIdSelect', 
    value: string | number,
    orderDataStateSetter: React.Dispatch<React.SetStateAction<Partial<Order>>>
  ) => {
    orderDataStateSetter(prev => {
      const items = [...(prev.items || [])];
      const currentItem = { ...items[index] };

      if (field === 'productIdSelect') {
        const selectedProductId = value as string;
        const product = availableProducts.find(p => p.id === selectedProductId);
        if (product) {
          currentItem.productId = product.id;
          currentItem.productName = product.name;
          currentItem.price = product.price; 
        } else { 
          currentItem.productId = ''; 
          currentItem.productName = 'Товар не знайдено'; 
          currentItem.price = 0; 
        }
      } else if (field === 'quantity' || field === 'price') {
        currentItem[field as 'quantity' | 'price'] = Number(value) < 0 ? 0 : Number(value);
      } else if (field === 'productName'){ 
          currentItem[field] = value as string;
      }
      
      items[index] = currentItem;
      return { ...prev, items, totalAmount: calculateTotalAmount(items) };
    });
  };

  const handleNewOrderItemChange = (index: number, field: keyof OrderItem | 'productIdSelect', value: string | number) => {
    handleItemChange(index, field, value, setNewOrderData);
  };

  const handleEditOrderItemChange = (index: number, field: keyof OrderItem | 'productIdSelect', value: string | number) => {
    handleItemChange(index, field, value, setCurrentOrderData);
  };

  const addItem = (orderDataStateSetter: React.Dispatch<React.SetStateAction<Partial<Order>>>) => {
    orderDataStateSetter(prev => {
      const newItems = [...(prev.items || []), { ...initialNewOrderItem }];
      return {
        ...prev,
        items: newItems,
        totalAmount: calculateTotalAmount(newItems)
      }
    });
  };

  const addNewOrderItem = () => addItem(setNewOrderData);
  const addEditOrderItem = () => addItem(setCurrentOrderData);

  const removeItem = (index: number, orderDataStateSetter: React.Dispatch<React.SetStateAction<Partial<Order>>>) => {
    orderDataStateSetter(prev => {
      const newItems = (prev.items || []).filter((_, i) => i !== index);
      return {
        ...prev,
        items: newItems,
        totalAmount: calculateTotalAmount(newItems)
      }
    });
  };
  const removeNewOrderItem = (index: number) => removeItem(index, setNewOrderData);
  const removeEditOrderItem = (index: number) => removeItem(index, setCurrentOrderData);


  const handleAddOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCustomer = customers.find(c => c.id === newOrderData.customerId);
    if (!selectedCustomer) {
      alert("Будь ласка, виберіть клієнта.");
      return;
    }
    
    const validItems = (newOrderData.items || []).filter(
        item => item.productId && item.productName && Number(item.quantity) > 0 && Number(item.price) >= 0
    );

    if (validItems.length === 0) {
        alert("Будь ласка, додайте принаймні один дійсний товар. Виберіть товар, переконайтеся, що кількість більша за 0, а ціна 0 або більше.");
        return;
    }

    const finalOrder: Order = {
      id: `ORD${Date.now().toString().slice(-5)}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      date: new Date().toISOString().split('T')[0],
      status: newOrderData.status || 'Pending',
      items: validItems,
      totalAmount: calculateTotalAmount(validItems),
    };
    setOrders(prevOrders => [finalOrder, ...prevOrders]);
    closeAddOrderModal();
  };
  
  const openAddOrderModal = () => {
    loadAuxiliaryData();
    setNewOrderData({
      customerId: '',
      status: 'Pending',
      items: [{ ...initialNewOrderItem }],
      totalAmount: 0,
    });
    setIsAddOrderModalOpen(true);
  };

  const closeAddOrderModal = () => {
    setIsAddOrderModalOpen(false);
  };

  const openEditModal = (order: Order) => {
    loadAuxiliaryData();
    setEditingOrder(order);
    setCurrentOrderData({
      ...order, 
      items: order.items.map(item => ({...item})) 
    });
    setIsEditOrderModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOrderModalOpen(false);
    setEditingOrder(null);
    setCurrentOrderData({});
  };

  const handleEditOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || !currentOrderData.items) { 
      alert("Помилка: Не вибрано замовлення для редагування або відсутні товари.");
      return;
    }

    const validItems = currentOrderData.items.filter(
      item => item.productId && item.productName && Number(item.quantity) > 0 && Number(item.price) >= 0
    );

    if (validItems.length === 0) {
      alert("Замовлення повинно містити принаймні один дійсний товар.");
      return;
    }
    
    const updatedOrder: Order = {
      ...editingOrder, 
      items: validItems,
      status: currentOrderData.status || editingOrder.status, 
      totalAmount: calculateTotalAmount(validItems),
    };

    setOrders(prevOrders => prevOrders.map(o => o.id === editingOrder.id ? updatedOrder : o));
    closeEditModal();
  };


  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewOrder = (order: Order) => {
    setViewOrder(order);
    setEditableOrderStatus(order.status); 
  };
  
  const handleUpdateOrderStatusInViewModal = () => {
    if (viewOrder && editableOrderStatus) {
      const updatedOrders = orders.map(o =>
        o.id === viewOrder.id ? { ...o, status: editableOrderStatus } : o
      );
      setOrders(updatedOrders);
      setViewOrder(prev => prev ? { ...prev, status: editableOrderStatus } : null);
    }
  };


  const closeModal = () => {
    setViewOrder(null);
    setEditableOrderStatus(undefined);
  };

  const openBillOfLadingModal = (order: Order) => {
    const customerDetail = customers.find(c => c.id === order.customerId);
    setSelectedOrderForBoL(order);
    setCustomerForBoL(customerDetail || null); // Handle case where customer might not be found
    setIsBillOfLadingModalOpen(true);
  };

  const closeBillOfLadingModal = () => {
    setIsBillOfLadingModalOpen(false);
    setSelectedOrderForBoL(null);
    setCustomerForBoL(null);
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-700">Список замовлень</h2>
        <button
          onClick={openAddOrderModal}
          aria-label="Додати нове замовлення"
          className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" /> Додати нове замовлення
        </button>
      </div>

      <input
        type="search"
        aria-label="Пошук замовлень"
        placeholder="Пошук замовлень за ID або ім'ям клієнта..."
        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID Замовлення</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Клієнт</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Дата</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Статус</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Сума</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{order.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{order.customerName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{order.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {orderStatusTranslations[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${order.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 md:space-x-2">
                    <button onClick={() => handleViewOrder(order)} className="text-sky-600 hover:text-sky-800 transition-colors px-1 py-1" aria-label={`Переглянути деталі замовлення ${order.id}`}>
                       <EyeIcon className="w-5 h-5 inline mr-1" /> <span className="hidden sm:inline">Перегляд</span>
                    </button>
                    <button onClick={() => openEditModal(order)} className="text-indigo-600 hover:text-indigo-800 transition-colors px-1 py-1" aria-label={`Редагувати замовлення ${order.id}`}>
                       <PencilIcon className="w-5 h-5 inline mr-1" /> <span className="hidden sm:inline">Редагувати</span>
                    </button>
                     <button onClick={() => openBillOfLadingModal(order)} className="text-teal-600 hover:text-teal-800 transition-colors px-1 py-1" aria-label={`Переглянути накладну для замовлення ${order.id}`}>
                       <DocumentTextIcon className="w-5 h-5 inline mr-1" /> <span className="hidden sm:inline">Накладна</span>
                    </button>
                  </td>
                </tr>
              ))}
               {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    {orders.length === 0 ? "Замовлень ще немає. Натисніть 'Додати нове замовлення', щоб створити." : "Замовлень, що відповідають вашому пошуку, не знайдено."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Order Modal */}
      {isAddOrderModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="add-order-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 id="add-order-modal-title" className="text-xl font-semibold text-slate-800">Додати нове замовлення</h3>
              <button onClick={closeAddOrderModal} aria-label="Закрити модальне вікно додавання замовлення" className="text-slate-400 hover:text-slate-600">
                <XMarkIcon className="w-6 h-6"/>
              </button>
            </div>
            <form onSubmit={handleAddOrderSubmit} className="space-y-4">
              <div>
                <label htmlFor="customer" className="block text-sm font-medium text-slate-700">Клієнт <span aria-hidden="true" className="text-red-500">*</span></label>
                <select
                  id="customer"
                  name="customerId"
                  value={newOrderData.customerId}
                  onChange={(e) => setNewOrderData(prev => ({ ...prev, customerId: e.target.value }))}
                  required
                  aria-required="true"
                  className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                >
                  <option value="" disabled>Виберіть клієнта</option>
                  {customers.length > 0 ? customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name} ({customer.email})</option>
                  )) : <option disabled>Клієнти відсутні. Додайте клієнтів на сторінці 'Клієнти'.</option>}
                </select>
              </div>

              <div>
                <h4 className="text-md font-medium text-slate-700 mb-2">Товари в замовленні <span aria-hidden="true" className="text-red-500">*</span></h4>
                {(newOrderData.items || []).map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 mb-3 items-center p-3 border rounded-md bg-slate-50">
                    <div className="col-span-12 sm:col-span-5">
                      <label htmlFor={`product-add-${index}`} className="sr-only">Товар</label>
                       <select
                        id={`product-add-${index}`}
                        value={item.productId}
                        onChange={(e) => handleNewOrderItemChange(index, 'productIdSelect', e.target.value)}
                        required
                        aria-required="true"
                        className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="" disabled>Виберіть товар</option>
                        {availableProducts.length > 0 ? availableProducts.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        )) : <option disabled>Товари відсутні. Додайте товари на сторінці 'Товари'.</option>}
                      </select>
                    </div>
                     <div className="col-span-6 sm:col-span-2">
                       <label htmlFor={`quantity-add-${index}`} className="sr-only">Кількість</label>
                       <input
                        id={`quantity-add-${index}`}
                        type="number"
                        placeholder="К-сть"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleNewOrderItemChange(index, 'quantity', e.target.value)}
                        required
                        aria-required="true"
                        disabled={!item.productId} 
                        className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 disabled:bg-slate-100"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label htmlFor={`price-add-${index}`} className="sr-only">Ціна</label>
                      <input
                        id={`price-add-${index}`}
                        type="number"
                        placeholder="Ціна"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => handleNewOrderItemChange(index, 'price', e.target.value)}
                        required
                        aria-required="true"
                        disabled={!item.productId} 
                        className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 disabled:bg-slate-100"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-2 flex justify-end">
                      { (newOrderData.items || []).length > 1 &&
                        <button type="button" onClick={() => removeNewOrderItem(index)} aria-label={`Видалити товар ${index + 1}`} className="text-red-500 hover:text-red-700 p-1">
                          <TrashIcon className="w-5 h-5"/>
                        </button>
                      }
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addNewOrderItem}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                  <PlusIcon className="w-4 h-4 mr-1"/> Додати товар
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label htmlFor="status-add" className="block text-sm font-medium text-slate-700">Статус</label>
                  <select
                    id="status-add"
                    name="status"
                    value={newOrderData.status}
                    onChange={(e) => setNewOrderData(prev => ({ ...prev, status: e.target.value as Order['status'] }))}
                    className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  >
                    {orderStatusValues.map(statusValue => (
                        <option key={statusValue} value={statusValue}>{orderStatusTranslations[statusValue]}</option>
                    ))}
                  </select>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700">Загальна сума</p>
                    <p className="text-xl font-semibold text-slate-800 mt-1">${calculateTotalAmount(newOrderData.items).toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                 <button 
                    type="button"
                    onClick={closeAddOrderModal} 
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
                  >
                    Скасувати
                  </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
                  disabled={!newOrderData.customerId || (customers.length === 0 && !mockCustomersData.find(c => c.id === newOrderData.customerId)) || (newOrderData.items || []).some(item => !item.productId || item.quantity <= 0)}
                >
                  Зберегти замовлення
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {isEditOrderModalOpen && editingOrder && (
        <div role="dialog" aria-modal="true" aria-labelledby={`edit-order-modal-title-${editingOrder.id}`} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 id={`edit-order-modal-title-${editingOrder.id}`} className="text-xl font-semibold text-slate-800">Редагувати замовлення: {editingOrder.id}</h3>
              <button onClick={closeEditModal} aria-label="Закрити модальне вікно редагування замовлення" className="text-slate-400 hover:text-slate-600">
                <XMarkIcon className="w-6 h-6"/>
              </button>
            </div>
            <form onSubmit={handleEditOrderSubmit} className="space-y-4">
              <div>
                <p className="block text-sm font-medium text-slate-700">Клієнт</p>
                <p className="mt-1 text-sm text-slate-600 bg-slate-100 p-2 rounded-md">{editingOrder.customerName} ({editingOrder.customerId})</p>
              </div>

              <div>
                <h4 className="text-md font-medium text-slate-700 mb-2">Товари в замовленні <span aria-hidden="true" className="text-red-500">*</span></h4>
                {(currentOrderData.items || []).map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 mb-3 items-center p-3 border rounded-md bg-slate-50">
                    <div className="col-span-12 sm:col-span-5">
                      <label htmlFor={`product-edit-${index}`} className="sr-only">Товар</label>
                       <select
                        id={`product-edit-${index}`}
                        value={item.productId}
                        onChange={(e) => handleEditOrderItemChange(index, 'productIdSelect', e.target.value)}
                        required
                        aria-required="true"
                        className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="" disabled>Виберіть товар</option>
                        {availableProducts.map(product => (
                          <option 
                            key={product.id} 
                            value={product.id} 
                          >
                            {product.name}
                          </option>
                        ))}
                         {availableProducts.length === 0 && <option disabled>Товари відсутні</option>}
                      </select>
                    </div>
                     <div className="col-span-6 sm:col-span-2">
                       <label htmlFor={`quantity-edit-${index}`} className="sr-only">Кількість</label>
                       <input
                        id={`quantity-edit-${index}`}
                        type="number"
                        placeholder="К-сть"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleEditOrderItemChange(index, 'quantity', e.target.value)}
                        required
                        aria-required="true"
                        disabled={!item.productId} 
                        className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 disabled:bg-slate-100"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label htmlFor={`price-edit-${index}`} className="sr-only">Ціна</label>
                      <input
                        id={`price-edit-${index}`}
                        type="number"
                        placeholder="Ціна"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => handleEditOrderItemChange(index, 'price', e.target.value)}
                        required
                        aria-required="true"
                        disabled={!item.productId} 
                        className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm p-2 disabled:bg-slate-100"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-2 flex justify-end">
                      { (currentOrderData.items || []).length > 1 &&
                        <button type="button" onClick={() => removeEditOrderItem(index)} aria-label={`Видалити товар ${index + 1}`} className="text-red-500 hover:text-red-700 p-1">
                          <TrashIcon className="w-5 h-5"/>
                        </button>
                      }
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEditOrderItem}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                  <PlusIcon className="w-4 h-4 mr-1"/> Додати товар
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label htmlFor="status-edit" className="block text-sm font-medium text-slate-700">Статус</label>
                  <select
                    id="status-edit"
                    name="status"
                    value={currentOrderData.status}
                    onChange={(e) => setCurrentOrderData(prev => ({ ...prev, status: e.target.value as Order['status'] }))}
                    className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  >
                    {orderStatusValues.map(statusValue => (
                        <option key={statusValue} value={statusValue}>{orderStatusTranslations[statusValue]}</option>
                    ))}
                  </select>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700">Загальна сума</p>
                    <p className="text-xl font-semibold text-slate-800 mt-1">${calculateTotalAmount(currentOrderData.items).toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                 <button 
                    type="button"
                    onClick={closeEditModal} 
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
                  >
                    Скасувати
                  </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
                  disabled={(currentOrderData.items || []).some(item => !item.productId || item.quantity <= 0)}
                >
                  Зберегти зміни
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* View Order Modal */}
      {viewOrder && (
        <div role="dialog" aria-modal="true" aria-labelledby={`view-order-modal-title-${viewOrder.id}`} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 id={`view-order-modal-title-${viewOrder.id}`} className="text-xl font-semibold text-slate-800">Деталі замовлення: {viewOrder.id}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно перегляду замовлення" className="text-slate-400 hover:text-slate-600">
                <XMarkIcon className="w-6 h-6"/>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Ім'я клієнта</p>
                  <p className="font-medium text-slate-700">{viewOrder.customerName}</p>
                </div>
                 <div>
                  <p className="text-sm text-slate-500">ID Клієнта</p>
                  <p className="font-medium text-slate-700">{viewOrder.customerId}</p>
                </div>
                 <div>
                  <p className="text-sm text-slate-500">Дата замовлення</p>
                  <p className="font-medium text-slate-700">{viewOrder.date}</p>
                </div>
                 <div>
                    <label htmlFor="view-order-status" className="block text-sm text-slate-500">Статус</label>
                    <select
                        id="view-order-status"
                        value={editableOrderStatus}
                        onChange={(e) => setEditableOrderStatus(e.target.value as Order['status'])}
                        className={`mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 font-medium ${getStatusColor(editableOrderStatus || viewOrder.status).replace('bg-', 'text-').replace('-100', '-800')}`}
                    >
                        {orderStatusValues.map(statusValue => (
                            <option key={statusValue} value={statusValue}>{orderStatusTranslations[statusValue]}</option>
                        ))}
                    </select>
                </div>
                 <div className="sm:col-span-2">
                  <p className="text-sm text-slate-500">Загальна сума замовлення</p>
                  <p className="font-medium text-slate-700 text-lg">${viewOrder.totalAmount.toFixed(2)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">Замовлені товари ({viewOrder.items.length}):</p>
                <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md max-h-60 overflow-y-auto">
                  {viewOrder.items.map((item, index) => (
                    <li key={index} className="p-3 flex justify-between items-center text-sm bg-slate-50 even:bg-white">
                      <div>
                        <p className="font-medium text-slate-700">{item.productName}</p>
                        <p className="text-xs text-slate-500">ID: {item.productId} &bull; К-сть: {item.quantity} @ ${item.price.toFixed(2)} за од.</p>
                      </div>
                      <p className="text-slate-600 font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-8 flex justify-between items-center">
               <button 
                onClick={closeModal} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
              >
                Закрити
              </button>
              <button 
                onClick={handleUpdateOrderStatusInViewModal} 
                disabled={editableOrderStatus === viewOrder.status}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Оновити статус
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill of Lading Modal */}
      {isBillOfLadingModalOpen && selectedOrderForBoL && (
        <BillOfLadingModal
          order={selectedOrderForBoL}
          customer={customerForBoL}
          onClose={closeBillOfLadingModal}
        />
      )}
    </div>
  );
};

interface BillOfLadingModalProps {
  order: Order | null;
  customer: Customer | null;
  onClose: () => void;
}

const BillOfLadingModal: React.FC<BillOfLadingModalProps> = ({ order, customer, onClose }) => {
  if (!order) return null;

  const shipper = {
    name: 'E-Commerce Store Deluxe', // Example name, can be localized or configured
    address: 'вул. Веб-Магазинна 123, м. Технологічне, ТХ 75001, США',
    contact: '(555) 123-4567',
  };

  const carrier = {
    name: 'Global Logistics Inc.', // Example name
    contact: '(555) 987-6543',
  };
  
  const calculateApproxWeight = (items: OrderItem[]) => {
    return items.reduce((acc, item) => acc + 0.5 + (item.quantity * 0.1), 0).toFixed(1);
  };

  const handlePrint = () => {
    const printableArea = document.getElementById('billOfLadingContent');
    if (printableArea) {
      const printWindow = window.open('', '_blank');
      printWindow?.document.write('<html><head><title>Накладна</title>');
      printWindow?.document.write('<link href="https://cdn.tailwindcss.com" rel="stylesheet">');
      printWindow?.document.write(`
        <style>
          body { margin: 20px; font-family: Arial, sans-serif; font-size: 10pt; }
          .bol-container { border: 1px solid #ccc; padding: 20px; }
          .bol-header { text-align: center; font-size: 1.5em; font-weight: bold; margin-bottom: 20px; }
          .bol-section { margin-bottom: 15px; padding: 10px; border: 1px solid #eee; }
          .bol-section-title { font-weight: bold; margin-bottom: 5px; font-size: 0.9em; text-transform: uppercase; color: #333; }
          .bol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .bol-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
          .bol-table th, .bol-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          .bol-table th { background-color: #f8f8f8; }
          .signatures { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 9pt;}
          .signatures div { margin-top: 20px; }
          .no-print { display: none !important; }
          p { margin: 2px 0; }
        </style>
      `);
      printWindow?.document.write('</head><body>');
      printWindow?.document.write(printableArea.innerHTML);
      printWindow?.document.write('</body></html>');
      printWindow?.document.close();
      printWindow?.focus();
      setTimeout(() => {
        printWindow?.print();
      }, 500); 
    }
  };


  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bol-modal-title" className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 id="bol-modal-title" className="text-xl font-semibold text-slate-800">Накладна - Замовлення: {order.id}</h3>
          <button onClick={onClose} aria-label="Закрити модальне вікно накладної" className="text-slate-400 hover:text-slate-600">
            <XMarkIcon className="w-6 h-6"/>
          </button>
        </div>
        
        <div className="overflow-y-auto flex-grow pr-2 text-sm">
          <div id="billOfLadingContent" className="bol-container">
            <div className="bol-header">НАКЛАДНА</div>
            <div className="text-right mb-4"><strong>Дата видачі:</strong> {new Date().toLocaleDateString()}</div>

            <div className="bol-grid">
              <div className="bol-section">
                <div className="bol-section-title">Відправник</div>
                <p><strong>{shipper.name}</strong></p>
                <p>{shipper.address}</p>
                <p>Контакт: {shipper.contact}</p>
              </div>
              <div className="bol-section">
                <div className="bol-section-title">Одержувач</div>
                {customer ? (
                  <>
                    <p><strong>{customer.name}</strong></p>
                    <p>{customer.address?.street}</p>
                    <p>{customer.address?.city}, {customer.address?.state} {customer.address?.zip}</p>
                    <p>{customer.address?.country}</p>
                    <p>Контакт: {customer.phone || customer.email}</p>
                  </>
                ) : <p>Дані клієнта недоступні.</p>}
              </div>
            </div>

            <div className="bol-section">
              <div className="bol-section-title">Перевізник</div>
              <p><strong>{carrier.name}</strong></p>
              <p>Контакт: {carrier.contact}</p>
            </div>

            <div className="bol-section">
              <div className="bol-section-title">Деталі відправлення</div>
              <p><strong>ID Замовлення:</strong> {order.id}</p>
              <p><strong>Дата відправлення:</strong> {order.date}</p>
              <p><strong>Кількість місць:</strong> 1 (Партія)</p>
              <p><strong>Загальна вага брутто (прибл.):</strong> {calculateApproxWeight(order.items)} кг</p>
              <p><strong>Загальна вартість замовлення:</strong> ${order.totalAmount.toFixed(2)}</p>
              <p><strong>Оголошена вартість для перевезення:</strong> ${order.totalAmount.toFixed(2)}</p>
              
              <div className="bol-section-title mt-3">Опис товарів</div>
              <table className="bol-table">
                <thead>
                  <tr>
                    <th>Назва товару</th>
                    <th>Кількість</th>
                    <th>Ціна за од.</th>
                    <th>Загальна ціна</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>${item.price.toFixed(2)}</td>
                      <td>${(item.quantity * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bol-section">
              <div className="bol-section-title">Особливі вказівки</div>
              <p>Обережно. Стандартна доставка.</p>
            </div>

            <div className="text-xs mt-4">
              <p>ОТРИМАНО, відповідно до класифікацій та тарифів, чинних на дату видачі цієї Накладної, майно, описане вище, у належному стані, за винятком зазначеного (вміст та стан вмісту упаковок невідомі), марковане, доручене та призначене, як зазначено вище, яке зазначений перевізник (слово "перевізник" в цьому договорі означає будь-яку особу або корпорацію, що володіє майном за цим договором) зобов'язується перевезти до звичайного місця доставки за вказаним призначенням, якщо воно знаходиться на його власному маршруті, в іншому випадку – доставити іншому перевізнику на маршруті до зазначеного пункту призначення.</p>
            </div>

            <div className="signatures">
              <div>
                <p>Підпис відправника:</p>
                <div className="h-8 border-b border-gray-400 mt-2"></div>
                <p>Дата: _______________</p>
              </div>
              <div>
                <p>Підпис перевізника:</p>
                 <div className="h-8 border-b border-gray-400 mt-2"></div>
                <p>Дата: _______________</p>
              </div>
            </div>
             <div className="mt-6 text-center text-xs">
                Це необоротна накладна.
             </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t">
          <button 
            type="button"
            onClick={onClose} 
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
          >
            Закрити
          </button>
          <button 
            type="button" 
            onClick={handlePrint}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
          >
            <PrinterIcon className="w-5 h-5 mr-2"/> Роздрукувати накладну
          </button>
        </div>
      </div>
    </div>
  );
};


export default OrdersPage;
