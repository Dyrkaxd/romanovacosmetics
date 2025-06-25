
import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/Icons';

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const initialProductState: Partial<Product> = { 
    name: '', 
    retailPrice: 0, 
    salonPrice: 0, 
    exchangeRate: 0, 
    description: '', 
    imageUrl: '' 
  };
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>(initialProductState);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const API_BASE_URL = '/api'; 

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/products`);
      if (!response.ok) {
        let errorMessage = `Failed to fetch products. Status: ${response.status} ${response.statusText}`;
        let responseBodyText = '';
        try {
            responseBodyText = await response.text(); 
            const errData = JSON.parse(responseBodyText); 
            errorMessage = errData.message || `Server error: ${response.status} ${response.statusText}`;
        } catch (jsonError) {
            errorMessage = `Server responded with non-JSON (${response.status} ${response.statusText}): ${responseBodyText.substring(0, 200)}...`;
            console.error("Full non-JSON error response from server (fetchProducts):", responseBodyText);
        }
        throw new Error(errorMessage);
      }
      const data: Product[] = await response.json();
      setProducts(data);
    } catch (err: any) {
      console.error("Failed to fetch products:", err);
      setPageError(err.message || 'Could not load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ 
      ...prev, 
      [name]: (name === 'retailPrice' || name === 'salonPrice' || name === 'exchangeRate') ? parseFloat(value) : value 
    }));
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct.name || currentProduct.retailPrice == null || currentProduct.retailPrice < 0 ||
        currentProduct.salonPrice == null || currentProduct.salonPrice < 0 ||
        currentProduct.exchangeRate == null || currentProduct.exchangeRate <= 0) {
        setModalError("Назва, роздрібна ціна (невід'ємна), ціна салону (невід'ємна) та курс (позитивний) є обов'язковими.");
        return;
    }
    setModalError(null);
    setIsLoading(true);

    const productDataToSubmit: Partial<Product> = {
        name: currentProduct.name,
        retailPrice: currentProduct.retailPrice,
        salonPrice: currentProduct.salonPrice,
        exchangeRate: currentProduct.exchangeRate,
        description: currentProduct.description || '',
        imageUrl: currentProduct.imageUrl || editingProduct?.imageUrl || `https://picsum.photos/seed/${currentProduct.name?.replace(/\s+/g, '_') || 'newproduct'}/200/200`,
    };

    try {
      let response;
      if (editingProduct) {
        response = await fetch(`${API_BASE_URL}/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productDataToSubmit),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productDataToSubmit),
        });
      }

      if (!response.ok) {
        let errorMessage = `Failed to ${editingProduct ? 'update' : 'add'} product. Status: ${response.status} ${response.statusText}`;
        let responseBodyText = '';
        try {
            responseBodyText = await response.text();
            const errData = JSON.parse(responseBodyText);
            errorMessage = errData.message || `Server error: ${response.status} ${response.statusText}`;
        } catch (jsonError) {
            errorMessage = `Server responded with non-JSON (${response.status} ${response.statusText}): ${responseBodyText.substring(0, 200)}...`;
            console.error("Full non-JSON error response from server (handleSubmitProduct):", responseBodyText);
        }
        throw new Error(errorMessage);
      }
      fetchProducts(); 
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
            const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                 let errorMessage = `Failed to delete product. Status: ${response.status} ${response.statusText}`;
                 let responseBodyText = '';
                 try {
                     responseBodyText = await response.text();
                     const errData = JSON.parse(responseBodyText);
                     errorMessage = errData.message || `Server error: ${response.status} ${response.statusText}`;
                 } catch (jsonError) {
                     errorMessage = `Server responded with non-JSON (${response.status} ${response.statusText}): ${responseBodyText.substring(0, 200)}...`;
                     console.error("Full non-JSON error response from server (handleDeleteProduct):", responseBodyText);
                 }
                 throw new Error(errorMessage);
            }
            fetchProducts(); 
        } catch (err: any) {
            console.error("Failed to delete product:", err);
            setPageError(err.message || 'Could not delete product. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }
  };
  
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-xl font-semibold text-slate-700">Список товарів</h2>
        <button
          onClick={openAddModal}
          className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors w-full sm:w-auto justify-center"
          aria-label="Додати новий товар"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="hidden sm:inline ml-2">Додати новий товар</span>
          <span className="sm:hidden ml-2">Додати</span>
        </button>
      </div>
      
      <input
        type="search"
        placeholder="Пошук товарів за назвою..."
        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Пошук товарів"
      />

      {pageError && <div role="alert" className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{pageError}</div>}
      {isLoading && products.length === 0 && <div className="text-center p-4">Завантаження товарів...</div>}


      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Назва</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Ціна салону</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Ціна роздрібна</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Курс</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!isLoading && filteredProducts.length > 0 ? filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">${product.salonPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">${product.retailPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{product.exchangeRate.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 sm:space-x-2">
                    <button onClick={() => openViewModal(product)} className="text-sky-600 hover:text-sky-800 transition-colors p-1" aria-label={`Переглянути деталі для ${product.name}`} title="Переглянути"><EyeIcon className="w-5 h-5 inline"/></button>
                    <button onClick={() => openEditModal(product)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1" aria-label={`Редагувати ${product.name}`} title="Редагувати">
                         <PencilIcon className="w-5 h-5 inline"/>
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 transition-colors p-1" aria-label={`Видалити ${product.name}`} title="Видалити">
                        <TrashIcon className="w-5 h-5 inline"/>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    { !isLoading && products.length === 0 && !pageError && "Товарів ще немає. Натисніть 'Додати новий товар', щоб створити."}
                    { !isLoading && products.length > 0 && filteredProducts.length === 0 && "Товарів, що відповідають вашему пошуку, не знайдено."}
                    { isLoading && "Завантаження..."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 id="product-modal-title" className="text-lg font-semibold text-slate-800">{editingProduct ? 'Редагувати товар' : 'Додати новий товар'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
            {modalError && <div role="alert" className="mb-3 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{modalError}</div>}
            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">Назва <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="name" id="name" value={currentProduct.name || ''} onChange={handleInputChange} required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div> 
                    <label htmlFor="retailPrice" className="block text-sm font-medium text-slate-700">Ціна роздрібна <span aria-hidden="true" className="text-red-500">*</span></label>
                    <input type="number" name="retailPrice" id="retailPrice" value={currentProduct.retailPrice === undefined ? '' : currentProduct.retailPrice} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                </div>
                <div> 
                    <label htmlFor="salonPrice" className="block text-sm font-medium text-slate-700">Ціна салону <span aria-hidden="true" className="text-red-500">*</span></label>
                    <input type="number" name="salonPrice" id="salonPrice" value={currentProduct.salonPrice === undefined ? '' : currentProduct.salonPrice} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                </div>
              </div>
              <div> 
                  <label htmlFor="exchangeRate" className="block text-sm font-medium text-slate-700">Курс <span aria-hidden="true" className="text-red-500">*</span></label>
                  <input type="number" name="exchangeRate" id="exchangeRate" value={currentProduct.exchangeRate === undefined ? '' : currentProduct.exchangeRate} onChange={handleInputChange} step="0.01" min="0.01" required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">Опис</label>
                <textarea name="description" id="description" value={currentProduct.description || ''} onChange={handleInputChange} rows={3} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
               <div>
                <label htmlFor="imageUrl" className="block text-sm font-medium text-slate-700">URL зображення</label>
                <input type="url" name="imageUrl" id="imageUrl" value={currentProduct.imageUrl || ''} onChange={handleInputChange} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" placeholder="https://example.com/image.jpg"/>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end pt-2 space-y-3 sm:space-y-0">
                <button 
                    type="button" 
                    onClick={closeModal} 
                    className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors mr-2"
                    disabled={isLoading}
                >
                  Скасувати
                </button>
                <button type="submit" 
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50"
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
        <div role="dialog" aria-modal="true" aria-labelledby={`view-product-modal-title-${currentProduct.id}`} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 id={`view-product-modal-title-${currentProduct.id}`} className="text-lg font-semibold text-slate-800">{currentProduct.name}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
            <div className="space-y-3">
              <img src={(currentProduct as Product).imageUrl || `https://picsum.photos/seed/${currentProduct.id}/300/300`} alt={currentProduct.name} className="w-full h-auto rounded-md object-cover mb-3" />
              <p><span className="font-semibold text-slate-700">Назва:</span> <span className="text-slate-800">{currentProduct.name}</span></p>
              <p><span className="font-semibold text-slate-700">Ціна роздрібна:</span> <span className="text-slate-800">${currentProduct.retailPrice?.toFixed(2)}</span></p>
              <p><span className="font-semibold text-slate-700">Ціна салону:</span> <span className="text-slate-800">${currentProduct.salonPrice?.toFixed(2)}</span></p>
              <p><span className="font-semibold text-slate-700">Курс:</span> <span className="text-slate-800">{currentProduct.exchangeRate?.toFixed(2)}</span></p>
              <p className="font-semibold text-slate-700">Опис:</p>
              <p className="text-sm text-slate-800 bg-slate-50 p-3 rounded-md whitespace-pre-wrap break-words">{currentProduct.description || 'Опис відсутній.'}</p>
            </div>
            <div className="mt-6 text-right">
                <button onClick={closeModal} className="bg-slate-500 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors">
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