import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { PlusIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '../components/Icons';

// const PRODUCTS_STORAGE_KEY = 'ecomDashProducts'; // No longer used

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({ name: '', price: 0, description: '' });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [pageError, setPageError] = useState<string | null>(null); // For general page errors
  const [modalError, setModalError] = useState<string | null>(null); // For modal specific errors
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const API_BASE_URL = '/api'; // Netlify functions will be available here

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/products`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch products and parse error' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
    setCurrentProduct(prev => ({ ...prev, [name]: name === 'price' ? parseFloat(value) : value }));
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct.name || currentProduct.price == null || currentProduct.price < 0) {
        setModalError("Назва та ціна (невід'ємне число) є обов'язковими полями.");
        return;
    }
    setModalError(null);
    setIsLoading(true);

    const productDataToSubmit: Partial<Product> = {
        name: currentProduct.name,
        price: currentProduct.price,
        description: currentProduct.description || '',
        // Use a placeholder or let user upload an image later
        imageUrl: currentProduct.imageUrl || editingProduct?.imageUrl || `https://picsum.photos/seed/${currentProduct.name || 'new'}/200/200`,
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
        const errorData = await response.json().catch(() => ({ message: `Failed to ${editingProduct ? 'update' : 'add'} product.`}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      // const savedProduct: Product = await response.json(); // Not strictly needed if refetching or updating UI optimistically
      fetchProducts(); // Re-fetch to get the latest data including DB-generated ID/timestamps
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
    setCurrentProduct({ name: '', price: 0, description: '', imageUrl: '' });
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
    setCurrentProduct({ name: '', price: 0, description: '' });
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
                 const errorData = await response.json().catch(() => ({ message: 'Failed to delete product and parse error' }));
                 throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            fetchProducts(); // Re-fetch
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Зобр.</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Назва</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Ціна</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!isLoading && filteredProducts.length > 0 ? filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                    <img src={product.imageUrl || `https://picsum.photos/seed/${product.id}/40/40`} alt={product.name} className="w-10 h-10 rounded-md object-cover" />
                  </td>
                  <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{product.name}</td>
                  <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-700">${product.price.toFixed(2)}</td>
                  <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 sm:space-x-2">
                    <button onClick={() => openViewModal(product)} className="text-sky-600 hover:text-sky-800 transition-colors p-1" aria-label={`Переглянути деталі для ${product.name}`}><EyeIcon className="w-5 h-5 inline"/></button>
                    <button onClick={() => openEditModal(product)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1" aria-label={`Редагувати ${product.name}`}>
                         <PencilIcon className="w-5 h-5 inline"/> <span className="hidden md:inline ml-1">Редагувати</span>
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 transition-colors p-1" aria-label={`Видалити ${product.name}`}>
                        <TrashIcon className="w-5 h-5 inline"/> <span className="hidden md:inline ml-1">Видалити</span>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
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
              <div> 
                  <label htmlFor="price" className="block text-sm font-medium text-slate-700">Ціна <span aria-hidden="true" className="text-red-500">*</span></label>
                  <input type="number" name="price" id="price" value={currentProduct.price === undefined ? '' : currentProduct.price} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
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
              <p><span className="font-semibold text-slate-700">Ціна:</span> <span className="text-slate-800">${currentProduct.price?.toFixed(2)}</span></p>
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
