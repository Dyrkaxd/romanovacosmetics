import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Product, PaginatedResponse } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon, UploadIcon, DocumentTextIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';
import { useNavigate, useLocation } from 'react-router-dom';

const productGroups = ['BDR', 'LA', 'АГ', 'АБ', 'АР', 'без сокращений', 'АФ', 'ДС', 'м8', 'JDA', 'Faith', 'AB', 'ГФ', 'ЕС', 'ГП', 'СД', 'ATA', 'W', 'Гуаша'];

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const initialProductState: Partial<Product> = { 
    name: '', 
    retailPrice: 0, 
    salonPrice: 0, 
    exchangeRate: 0,
    quantity: 0,
    group: 'BDR', // Default group
  };
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>(initialProductState);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; } | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE_URL = '/api'; 

  const openEditModal = useCallback((product: Product) => {
    setEditingProduct(product);
    setCurrentProduct(product);
    setIsModalOpen(true);
    setModalError(null);
  }, []);

  const fetchProducts = useCallback(async (page = 1, size = pageSize, search = searchTerm) => {
    setIsLoading(true);
    setPageError(null);
    setCurrentPage(page);
    try {
      const query = new URLSearchParams({
          page: String(page),
          pageSize: String(size),
          search: search,
      });
      const response = await authenticatedFetch(`${API_BASE_URL}/products?${query.toString()}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Server error' }));
        throw new Error(errData.message || `Failed to fetch products. Status: ${response.status}`);
      }
      const data: PaginatedResponse<Product> = await response.json();
      setProducts(data.data);
      setTotalCount(data.totalCount);
      setCurrentPage(data.currentPage);
      setPageSize(data.pageSize);
      
      const editId = location.state?.openEditId;
      if (editId) {
          const productToEdit = data.data.find(p => p.id === editId);
          if (productToEdit) openEditModal(productToEdit);
          navigate(location.pathname, { replace: true, state: {} });
      }

    } catch (err: any) {
      console.error("Failed to fetch products:", err);
      setPageError(err.message || 'Could not load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, searchTerm, location.state, navigate, openEditModal]);

  useEffect(() => {
    fetchProducts(1, pageSize, searchTerm);
  }, [fetchProducts, pageSize, searchTerm]);


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };
  
  const handlePageChange = (page: number) => {
      fetchProducts(page, pageSize, searchTerm);
  };
  
  const handlePageSizeChange = (size: number) => {
      setPageSize(size);
      setCurrentPage(1); // Reset to first page
      fetchProducts(1, size, searchTerm);
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ 
      ...prev, 
      [name]: (name === 'retailPrice' || name === 'salonPrice' || name === 'exchangeRate' || name === 'quantity') ? parseFloat(value) : value 
    }));
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct.name || currentProduct.retailPrice == null || currentProduct.retailPrice < 0 ||
        currentProduct.salonPrice == null || currentProduct.salonPrice < 0 ||
        currentProduct.exchangeRate == null || currentProduct.exchangeRate <= 0 || !currentProduct.group) {
        setModalError("Назва, група, роздрібна ціна (невід'ємна), ціна салону (невід'ємна) та курс (позитивний) є обов'язковими.");
        return;
    }
    setModalError(null);
    setIsLoading(true);

    const productDataToSubmit: Partial<Product> = {
        name: currentProduct.name,
        retailPrice: currentProduct.retailPrice,
        salonPrice: currentProduct.salonPrice,
        exchangeRate: currentProduct.exchangeRate,
        group: currentProduct.group,
        quantity: Number.isFinite(currentProduct.quantity) ? currentProduct.quantity : 0,
    };

    try {
      let response;
      if (editingProduct) {
        response = await authenticatedFetch(`${API_BASE_URL}/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(productDataToSubmit),
        });
      } else {
        response = await authenticatedFetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          body: JSON.stringify(productDataToSubmit),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Server error' }));
        throw new Error(errData.message || `Could not ${editingProduct ? 'update' : 'add'} product.`);
      }
      fetchProducts(currentPage); // Refetch current page
      closeModal();
    } catch (err: any) {
      console.error("Failed to save product:", err);
      setModalError(err.message || `Could not ${editingProduct ? 'update' : 'add'} product. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setCurrentProduct(initialProductState);
    setIsModalOpen(true);
    setModalError(null);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProduct(initialProductState);
    setModalError(null);
  };

  const handleDeleteProduct = async (productId: string) => {
     if (window.confirm('Ви впевнені, що хочете видалити цей товар? Цю дію неможливо скасувати.')) {
        setIsLoading(true);
        setPageError(null);
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/products/${productId}`, { method: 'DELETE' });
            if (!response.ok && response.status !== 204) {
                 const errData = await response.json().catch(() => ({ message: 'Server error' }));
                 throw new Error(errData.message || 'Could not delete product.');
            }
            // Refetch data, stay on the same page if possible, or go to previous if it was the last item
            const newTotalCount = totalCount - 1;
            const newTotalPages = Math.ceil(newTotalCount / pageSize);
            const newCurrentPage = (currentPage > newTotalPages && newTotalPages > 0) ? newTotalPages : currentPage;
            fetchProducts(newCurrentPage);
        } catch (err: any) {
            console.error("Failed to delete product:", err);
            setPageError(err.message || 'Could not delete product. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }
  };

  // --- CSV Import Logic ---
  const openImportModal = () => {
    setSelectedFile(null);
    setImportResult(null);
    setIsImportModalOpen(true);
  };

  const closeImportModal = () => setIsImportModalOpen(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedFile(e.target.files[0]);
        setImportResult(null);
    }
  };

  const parseCSV = (csvText: string): Omit<Product, 'id' | 'quantity' | 'created_at'>[] => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      throw new Error("CSV файл повинен містити заголовок та принаймні один рядок даних.");
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const requiredHeaders = ['name', 'group', 'retailPrice', 'salonPrice', 'exchangeRate'];

    for (const requiredHeader of requiredHeaders) {
      if (!headers.includes(requiredHeader)) {
        throw new Error(`Відсутній обов'язковий стовпець: ${requiredHeader}. Перевірте, що назви стовпців вказані англійською мовою без пробілів.`);
      }
    }

    const headerIndexMap = requiredHeaders.reduce((acc, h) => {
        acc[h] = headers.indexOf(h);
        return acc;
    }, {} as Record<string, number>);

    const data = lines.slice(1).map((line, index) => {
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const values = line.split(regex).map(v => {
            let value = v.trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            return value.replace(/""/g, '"');
        });

      const name = values[headerIndexMap.name];
      const group = values[headerIndexMap.group];
      const retailPrice = parseFloat(values[headerIndexMap.retailPrice]);
      const salonPrice = parseFloat(values[headerIndexMap.salonPrice]);
      const exchangeRate = parseFloat(values[headerIndexMap.exchangeRate]);
      
      if (!name || !group) {
        throw new Error(`Рядок ${index + 2}: 'name' та 'group' не можуть бути порожніми.`);
      }
      if (isNaN(retailPrice) || isNaN(salonPrice) || isNaN(exchangeRate) || retailPrice < 0 || salonPrice < 0 || exchangeRate <= 0) {
        throw new Error(`Рядок ${index + 2}: ціни та курс повинні бути коректними додатніми числами (використовуйте крапку '.' як роздільник).`);
      }

      return { name, group, retailPrice, salonPrice, exchangeRate };
    });
    return data;
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    setImportResult(null);
    try {
        const fileContent = await selectedFile.text();
        const productsToImport = parseCSV(fileContent);

        const response = await authenticatedFetch(`${API_BASE_URL}/products-import`, {
            method: 'POST',
            body: JSON.stringify(productsToImport),
        });

        const resultData = await response.json();
        if (!response.ok) {
            throw new Error(resultData.message || 'Помилка на сервері під час імпорту.');
        }

        setImportResult({ success: true, message: resultData.message });
        fetchProducts(1); // Refresh the product list on the first page
    } catch (error: any) {
        setImportResult({ success: false, message: error.message });
    } finally {
        setIsImporting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Товари</h2>
        <div className="flex items-center space-x-2">
            <button
                onClick={openImportModal}
                className="flex items-center bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
                aria-label="Імпортувати товари з CSV"
            >
                <UploadIcon className="w-5 h-5" />
                <span className="ml-2">Імпорт</span>
            </button>
            <button
                onClick={openAddModal}
                className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
                aria-label="Додати новий товар"
            >
                <PlusIcon className="w-5 h-5" />
                <span className="ml-2">Додати товар</span>
            </button>
        </div>
      </div>
      
      <input
        type="search"
        placeholder="Пошук товарів за назвою..."
        className="w-full p-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
        value={searchTerm}
        onChange={handleSearchChange}
        aria-label="Пошук товарів"
      />

      {pageError && <div role="alert" className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg">{pageError}</div>}
      
      <div className="bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Назва</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Група</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">К-сть на складі</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Ціна роздрібна</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Завантаження...</td></tr>
              ) : products.length > 0 ? products.map((product) => (
                <tr key={product.id} className="hover:bg-rose-50/50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 dark:text-slate-100">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{product.group}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700 dark:text-slate-200">{product.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">${product.retailPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                    <button onClick={() => navigate(`/products/${product.id}`)} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors p-2 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10" aria-label={`Переглянути деталі для ${product.name}`} title="Переглянути"><EyeIcon className="w-5 h-5"/></button>
                    <button onClick={() => openEditModal(product)} className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-2 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label={`Редагувати ${product.name}`} title="Редагувати">
                         <PencilIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10" aria-label={`Видалити ${product.name}`} title="Видалити">
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    { !pageError && (totalCount === 0 && searchTerm === '' ? "Товарів ще немає. Натисніть 'Додати новий товар', щоб створити." : "Товарів, що відповідають вашему пошуку, не знайдено.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Завантаження...</div>
          ) : products.length > 0 ? (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {products.map(product => (
                <li key={product.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 pr-4">{product.name}</p>
                    <span className="font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-0.5 rounded-full text-xs inline-block flex-shrink-0">{product.group}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-y-2 text-sm pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Кількість</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">{product.quantity}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Роздріб ($)</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">{product.retailPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Курс (₴)</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">{product.exchangeRate.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-1 border-t border-slate-100 dark:border-slate-700 pt-3">
                    <button onClick={() => navigate(`/products/${product.id}`)} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors p-2 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10" aria-label={`Переглянути деталі для ${product.name}`} title="Переглянути"><EyeIcon className="w-5 h-5"/></button>
                    <button onClick={() => openEditModal(product)} className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-2 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label={`Редагувати ${product.name}`} title="Редагувати">
                      <PencilIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10" aria-label={`Видалити ${product.name}`} title="Видалити">
                      <TrashIcon className="w-5 h-5"/>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {!pageError && (totalCount === 0 && searchTerm === '' ? "Товарів ще немає. Натисніть 'Додати новий товар', щоб створити." : "Товарів, що відповідають вашему пошуку, не знайдено.")}
            </div>
          )}
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

      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-md md:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200 dark:border-slate-700">
              <h3 id="product-modal-title" className="text-xl font-semibold text-slate-800 dark:text-slate-100">{editingProduct ? 'Редагувати товар' : 'Додати новий товар'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg text-sm">{modalError}</div>}
            <form onSubmit={handleSubmitProduct} className="space-y-4 overflow-y-auto pr-2 flex-grow">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Назва <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="name" id="name" value={currentProduct.name || ''} onChange={handleInputChange} required aria-required="true" className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
              </div>
               <div>
                  <label htmlFor="group" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Група <span className="text-red-500">*</span></label>
                  <select
                    id="group"
                    name="group"
                    value={currentProduct.group || ''}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingProduct}
                    className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5 disabled:bg-slate-100 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                  >
                    {productGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {!!editingProduct && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Групу не можна змінити після створення товару.</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div> 
                    <label htmlFor="retailPrice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ціна роздрібна ($) <span aria-hidden="true" className="text-red-500">*</span></label>
                    <input type="number" name="retailPrice" id="retailPrice" value={currentProduct.retailPrice === undefined ? '' : currentProduct.retailPrice} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
                <div> 
                    <label htmlFor="salonPrice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ціна салону ($) <span aria-hidden="true" className="text-red-500">*</span></label>
                    <input type="number" name="salonPrice" id="salonPrice" value={currentProduct.salonPrice === undefined ? '' : currentProduct.salonPrice} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div> 
                      <label htmlFor="exchangeRate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Курс (UAH/$) <span aria-hidden="true" className="text-red-500">*</span></label>
                      <input type="number" name="exchangeRate" id="exchangeRate" value={currentProduct.exchangeRate === undefined ? '' : currentProduct.exchangeRate} onChange={handleInputChange} step="0.01" min="0.01" required aria-required="true" className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                  </div>
                   <div> 
                      <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Кількість на складі</label>
                      <input type="number" name="quantity" id="quantity" value={currentProduct.quantity === undefined ? '' : currentProduct.quantity} onChange={handleInputChange} step="1" min="0" required className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                  </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end pt-6 space-y-2 sm:space-y-0 sm:space-x-3 border-t border-slate-200 dark:border-slate-700">
                <button 
                    type="button" 
                    onClick={closeModal} 
                    className="w-full sm:w-auto bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
                    disabled={isLoading}
                >
                  Скасувати
                </button>
                <button type="submit" 
                    className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    disabled={isLoading}
                >
                  {isLoading ? (editingProduct ? 'Збереження...' : 'Додавання...') : (editingProduct ? 'Зберегти зміни' : 'Додати товар')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="import-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200 dark:border-slate-700">
              <h3 id="import-modal-title" className="text-xl font-semibold text-slate-800 dark:text-slate-100">Імпорт товарів з CSV</h3>
              <button onClick={closeImportModal} aria-label="Закрити модальне вікно" disabled={isImporting}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"/></button>
            </div>
            
            {importResult && (
                <div role="alert" className={`mb-4 p-3 border rounded-lg text-sm ${importResult.success ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'}`}>
                    {importResult.message}
                </div>
            )}

            <div className="space-y-4 overflow-y-auto pr-2 flex-grow">
                <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                    <p className="font-semibold mb-2">Інструкція:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Файл повинен бути у форматі CSV (кодування UTF-8).</li>
                        <li>Перший рядок - заголовки стовпців.</li>
                        <li>Обов'язкові стовпці: <strong>name, group, retailPrice, salonPrice, exchangeRate</strong>.</li>
                        <li>Стовпець <strong>quantity</strong> (кількість) не використовується. Кількість існуючих товарів не зміниться, а для нових буде 0.</li>
                        <li>Десяткові числа (ціни, курс) слід вводити через крапку (напр., <strong>40.5</strong>).</li>
                    </ul>
                </div>
                
                <label htmlFor="csv-upload" className="w-full cursor-pointer flex items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-rose-400 dark:hover:border-rose-500 rounded-lg transition-colors">
                    <DocumentTextIcon className="w-6 h-6 mr-3 text-slate-400"/>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{selectedFile ? selectedFile.name : 'Натисніть, щоб вибрати CSV файл'}</span>
                </label>
                <input id="csv-upload" type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />

            </div>

            <div className="flex flex-col sm:flex-row justify-end pt-6 space-y-2 sm:space-y-0 sm:space-x-3 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={closeImportModal} className="w-full sm:w-auto bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg" disabled={isImporting}>
                    Скасувати
                </button>
                <button onClick={handleImport} className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50" disabled={!selectedFile || isImporting}>
                    {isImporting ? 'Імпортування...' : 'Імпортувати'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;