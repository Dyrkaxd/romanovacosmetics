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

  // State for AI suggestions
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Product[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // State for actions dropdown
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
    // Reset AI state
    setAiSuggestions([]);
    setShowAiSuggestions(false);
    setAiError(null);
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

  const handleDeleteOrder = async (orderId: string) => {
      if (window.confirm('Ви впевнені, що хочете видалити це замовлення? Цю дію неможливо скасувати.')) {
          setIsLoading(true);
          try {
              const res = await authenticatedFetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
              if (res.status !== 204) {
                  const errorData = await res.json().catch(() => ({}));
                  throw new Error(errorData.message || 'Не вдалося видалити замовлення.');
              }
              setSuccessMessage('Замовлення успішно видалено.');
              // After deletion, refetch orders. We might need to go to a previous page if it was the last item.
              const newTotalCount = totalCount - 1;
              const newTotalPages = Math.ceil(newTotalCount / pageSize);
              const newCurrentPage = (currentPage > newTotalPages && newTotalPages > 0) ? newTotalPages : currentPage;
              if (newCurrentPage !== currentPage) {
                  setCurrentPage(newCurrentPage);
              } else {
                  fetchOrders(newCurrentPage);
              }
          } catch (err: any) {
              setPageError(err.message || 'Не вдалося видалити замовлення.');
          } finally {
              setIsLoading(false);
          }
      }
  };

    // JSX for the component
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Замовлення</h1>
            {/* Add more JSX for filters, table, and modals */}
        </div>
    );
};

export default OrdersPage;
