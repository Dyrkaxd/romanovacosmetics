

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, PaginatedResponse } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';
import Pagination from '../components/Pagination';

const productGroups = ['BDR', 'LA', 'АГ', 'АБ', 'АР', 'без сокращений', 'АФ', 'ДС', 'м8', 'JDA', 'Faith', 'AB', 'ГФ', 'ЕС', 'ГП', 'СД', 'ATA', 'W'];

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
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
  
  const API_BASE_URL = '/api'; 

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
    } catch (err: any) {
      console.error("Failed to fetch products:", err);
      setPageError(err.message || 'Could not load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, searchTerm]);

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
  
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setCurrentProduct(product);
    setIsModalOpen(true);
    setModalError(null);
  };

  const openViewModal = (product: Product) => {
    setCurrentProduct(product);
    setIsViewModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsViewModalOpen(false);
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
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Товари</h2>
        <button
          onClick={openAddModal}
          className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
          aria-label="Додати новий товар"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="ml-2">Додати товар</span>
        </button>
      </div>
      
      <input
        type="search"
        placeholder="Пошук товарів за назвою..."
        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
        value={searchTerm}
        onChange={handleSearchChange}
        aria-label="Пошук товарів"
      />

      {pageError && <div role="alert" className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">{pageError}</div>}
      
      <div className="bg-white shadow-sm rounded-xl border border-slate-200">
        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Назва</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Група</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">К-сть на складі</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Ціна роздрібна</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Завантаження...</td></tr>
              ) : products.length > 0 ? products.map((product) => (
                <tr key={product.id} className="hover:bg-rose-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{product.group}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">{product.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">${product.retailPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                    <button onClick={() => openViewModal(product)} className="text-slate-500 hover:text-sky-600 transition-colors p-2 rounded-md hover:bg-sky-50" aria-label={`Переглянути деталі для ${product.name}`} title="Переглянути"><EyeIcon className="w-5 h-5"/></button>
                    <button onClick={() => openEditModal(product)} className="text-slate-500 hover:text-rose-600 transition-colors p-2 rounded-md hover:bg-rose-50" aria-label={`Редагувати ${product.name}`} title="Редагувати">
                         <PencilIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50" aria-label={`Видалити ${product.name}`} title="Видалити">
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
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
            <div className="p-6 text-center text-sm text-slate-500">Завантаження...</div>
          ) : products.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {products.map(product => (
                <li key={product.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-slate-800 pr-4">{product.name}</p>
                    <span className="font-medium text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full text-xs inline-block flex-shrink-0">{product.group}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-y-2 text-sm pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-slate-500">Кількість</p>
                      <p className="font-medium text-slate-700">{product.quantity}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Роздріб ($)</p>
                      <p className="font-medium text-slate-700">{product.retailPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Курс (₴)</p>
                      <p className="font-medium text-slate-700">{product.exchangeRate.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-1 border-t border-slate-100 pt-3">
                    <button onClick={() => openViewModal(product)} className="text-slate-500 hover:text-sky-600 transition-colors p-2 rounded-md hover:bg-sky-50" aria-label={`Переглянути деталі для ${product.name}`} title="Переглянути"><EyeIcon className="w-5 h-5"/></button>
                    <button onClick={() => openEditModal(product)} className="text-slate-500 hover:text-rose-600 transition-colors p-2 rounded-md hover:bg-rose-50" aria-label={`Редагувати ${product.name}`} title="Редагувати">
                      <PencilIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50" aria-label={`Видалити ${product.name}`} title="Видалити">
                      <TrashIcon className="w-5 h-5"/>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
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
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md md:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-200">
              <h3 id="product-modal-title" className="text-xl font-semibold text-slate-800">{editingProduct ? 'Редагувати товар' : 'Додати новий товар'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
            </div>
            {modalError && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{modalError}</div>}
            <form onSubmit={handleSubmitProduct} className="space-y-4 overflow-y-auto pr-2 flex-grow">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Назва <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="name" id="name" value={currentProduct.name || ''} onChange={handleInputChange} required aria-required="true" className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
              </div>
               <div>
                  <label htmlFor="group" className="block text-sm font-medium text-slate-700 mb-1">Група <span className="text-red-500">*</span></label>
                  <select
                    id="group"
                    name="group"
                    value={currentProduct.group || ''}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingProduct}
                    className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    {productGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {!!editingProduct && <p className="text-xs text-slate-500 mt-1">Групу не можна змінити після створення товару.</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div> 
                    <label htmlFor="retailPrice" className="block text-sm font-medium text-slate-700 mb-1">Ціна роздрібна ($) <span aria-hidden="true" className="text-red-500">*</span></label>
                    <input type="number" name="retailPrice" id="retailPrice" value={currentProduct.retailPrice === undefined ? '' : currentProduct.retailPrice} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
                <div> 
                    <label htmlFor="salonPrice" className="block text-sm font-medium text-slate-700 mb-1">Ціна салону ($) <span aria-hidden="true" className="text-red-500">*</span></label>
                    <input type="number" name="salonPrice" id="salonPrice" value={currentProduct.salonPrice === undefined ? '' : currentProduct.salonPrice} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div> 
                      <label htmlFor="exchangeRate" className="block text-sm font-medium text-slate-700 mb-1">Курс (UAH/$) <span aria-hidden="true" className="text-red-500">*</span></label>
                      <input type="number" name="exchangeRate" id="exchangeRate" value={currentProduct.exchangeRate === undefined ? '' : currentProduct.exchangeRate} onChange={handleInputChange} step="0.01" min="0.01" required aria-required="true" className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                  </div>
                   <div> 
                      <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">Кількість на складі</label>
                      <input type="number" name="quantity" id="quantity" value={currentProduct.quantity === undefined ? '' : currentProduct.quantity} onChange={handleInputChange} step="1" min="0" required className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" />
                  </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end pt-6 space-y-2 sm:space-y-0 sm:space-x-3 border-t border-slate-200">
                <button 
                    type="button" 
                    onClick={closeModal} 
                    className="w-full sm:w-auto bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors"
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
      {isViewModalOpen && currentProduct && currentProduct.id && (
        <div role="dialog" aria-modal="true" aria-labelledby={`view-product-modal-title-${currentProduct.id}`} className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <h3 id={`view-product-modal-title-${currentProduct.id}`} className="text-xl font-semibold text-slate-800">{currentProduct.name}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
            </div>
            <div className="space-y-4 overflow-y-auto pr-2">
              <div className='space-y-2'>
                <p><span className="font-semibold text-slate-600">Назва:</span> <span className="text-slate-800">{currentProduct.name}</span></p>
                <p><span className="font-semibold text-slate-600">Група:</span> <span className="font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-sm inline-block">{currentProduct.group}</span></p>
                 <p><span className="font-semibold text-slate-600">Кількість на складі:</span> <span className="text-slate-800 font-bold">{currentProduct.quantity}</span></p>
                <p><span className="font-semibold text-slate-600">Ціна роздрібна:</span> <span className="text-slate-800">${currentProduct.retailPrice?.toFixed(2)}</span></p>
                <p><span className="font-semibold text-slate-600">Ціна салону:</span> <span className="text-slate-800">${currentProduct.salonPrice?.toFixed(2)}</span></p>
                <p><span className="font-semibold text-slate-600">Курс:</span> <span className="text-slate-800">{currentProduct.exchangeRate?.toFixed(2)}</span></p>
              </div>
            </div>
            <div className="mt-6 pt-6 text-right border-t border-slate-200">
                <button onClick={closeModal} className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors">
                  Закрити
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;