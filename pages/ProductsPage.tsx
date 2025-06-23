
import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { generateProductDescription } from '../services/geminiService';
import { PlusIcon, SparklesIcon, SpinnerIcon, XMarkIcon, EyeIcon } from '../components/Icons';

const initialProductsData: Product[] = [
  { id: 'PROD001', name: 'Wireless Ergonomic Mouse', category: 'Electronics', price: 49.99, description: 'Зручна та чутлива бездротова миша для щоденного використання.', imageUrl: 'https://picsum.photos/seed/mouse/200/200' },
  { id: 'PROD002', name: 'Organic Green Tea', category: 'Groceries', price: 12.50, description: 'Органічний зелений чай преміум якості, багатий антиоксидантами.', imageUrl: 'https://picsum.photos/seed/tea/200/200' },
  { id: 'PROD003', name: 'Modern Bookshelf', category: 'Furniture', price: 199.00, description: 'Стильна та міцна книжкова полиця, ідеальна для будь-якого сучасного житлового простору.', imageUrl: 'https://picsum.photos/seed/bookshelf/200/200' },
  { id: 'PROD004', name: 'Running Shoes', category: 'Apparel', price: 89.99, description: '', imageUrl: 'https://picsum.photos/seed/shoes/200/200' },
  { id: 'PROD005', name: 'Smart Thermostat', category: 'Home Automation', price: 129.00, description: '', imageUrl: 'https://picsum.photos/seed/thermostat/200/200' },
];

const PRODUCTS_STORAGE_KEY = 'ecomDashProducts';

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (storedProducts) {
      try {
        const parsedProducts = JSON.parse(storedProducts);
        // Ensure parsed products conform to the new Product type (without stock)
        const validProducts = parsedProducts.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          description: p.description,
          imageUrl: p.imageUrl
        }));
        return validProducts.length > 0 ? validProducts : initialProductsData.map(p => ({...p})); // Clone initial data
      } catch (e) {
        console.error("Помилка розбору товарів з localStorage", e);
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(initialProductsData.map(p => ({...p}))));
        return initialProductsData.map(p => ({...p}));
      }
    }
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(initialProductsData.map(p => ({...p}))));
    return initialProductsData.map(p => ({...p}));
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({ name: '', category: '', price: 0, description: '' });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }, [products]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ ...prev, [name]: name === 'price' ? parseFloat(value) : value }));
  };

  const handleGenerateDescription = useCallback(async () => {
    if (!currentProduct.name || !currentProduct.category) {
      setError('Назва товару та категорія необхідні для генерації опису.');
      return;
    }
    setIsLoadingDescription(true);
    setError(null);
    try {
      const description = await generateProductDescription(currentProduct.name, currentProduct.category);
      setCurrentProduct(prev => ({ ...prev, description }));
    } catch (err) {
      setError((err as Error).message || 'Не вдалося згенерувати опис.');
    } finally {
      setIsLoadingDescription(false);
    }
  }, [currentProduct.name, currentProduct.category]);

  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct.name || !currentProduct.category || currentProduct.price == null) {
        setError("Назва, категорія та ціна є обов'язковими полями.");
        return;
    }
    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...currentProduct, id: editingProduct.id, imageUrl: p.imageUrl || `https://picsum.photos/seed/${currentProduct.name}/200/200` } as Product : p));
    } else {
      setProducts(prevProducts => [{ ...currentProduct, id: `PROD${Date.now().toString().slice(-5)}`, imageUrl: `https://picsum.photos/seed/${currentProduct.name}/200/200` } as Product, ...prevProducts]);
    }
    closeModal();
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setCurrentProduct({ name: '', category: '', price: 0, description: '' });
    setIsModalOpen(true);
    setError(null);
  };
  
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setCurrentProduct(product);
    setIsModalOpen(true);
    setError(null);
  };

  const openViewModal = (product: Product) => {
    setCurrentProduct(product);
    setIsViewModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsViewModalOpen(false);
    setCurrentProduct({ name: '', category: '', price: 0, description: '' });
    setError(null);
  };

  const handleDeleteProduct = (productId: string) => {
     if (window.confirm('Ви впевнені, що хочете видалити цей товар? Цю дію неможливо скасувати.')) {
        setProducts(products.filter(p => p.id !== productId));
    }
  };
  
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-700">Список товарів</h2>
        <div className="flex space-x-2">
          <button
            onClick={openAddModal}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors"
            aria-label="Додати новий товар"
          >
            <PlusIcon className="w-5 h-5 mr-2" /> Додати новий товар
          </button>
        </div>
      </div>
      
      <input
        type="search"
        placeholder="Пошук товарів за назвою або категорією..."
        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Пошук товарів"
      />

      {error && <div role="alert" className="p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{error}</div>}

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Зображення</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Назва</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Категорія</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ціна</th>
                {/* <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">На складі</th> Removed Stock Column Header */}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Статус опису</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredProducts.length > 0 ? filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <img src={product.imageUrl || `https://picsum.photos/seed/${product.id}/40/40`} alt={product.name} className="w-10 h-10 rounded-md object-cover" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{product.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${product.price.toFixed(2)}</td>
                  {/* <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {product.stock > 0 ? `${product.stock} В наявності` : 'Немає в наявності'}
                    </span>
                  </td> Removed Stock Column Data */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {product.description && product.description.length > 10 ? 
                      <span className="text-green-600">Згенеровано</span> : 
                      <span className="text-amber-600">Потрібен ШІ</span>
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onClick={() => openViewModal(product)} className="text-sky-600 hover:text-sky-800 transition-colors" aria-label={`Переглянути деталі для ${product.name}`}><EyeIcon className="w-5 h-5 inline"/></button>
                    <button onClick={() => openEditModal(product)} className="text-indigo-600 hover:text-indigo-800 transition-colors" aria-label={`Редагувати ${product.name}`}>Редагувати</button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 transition-colors" aria-label={`Видалити ${product.name}`}>Видалити</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500"> {/* Adjusted colSpan */}
                    {products.length === 0 ? "Товарів ще немає. Натисніть 'Додати новий товар', щоб створити." : "Товарів, що відповідають вашому пошуку, не знайдено."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 id="product-modal-title" className="text-lg font-semibold">{editingProduct ? 'Редагувати товар' : 'Додати новий товар'}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
            {error && <div role="alert" className="mb-3 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">{error}</div>}
            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">Назва <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="name" id="name" value={currentProduct.name || ''} onChange={handleInputChange} required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-700">Категорія <span aria-hidden="true" className="text-red-500">*</span></label>
                <input type="text" name="category" id="category" value={currentProduct.category || ''} onChange={handleInputChange} required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
              <div> {/* Price input now takes full width */}
                  <label htmlFor="price" className="block text-sm font-medium text-slate-700">Ціна <span aria-hidden="true" className="text-red-500">*</span></label>
                  <input type="number" name="price" id="price" value={currentProduct.price || ''} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
              {/* Stock input removed
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-slate-700">Ціна <span aria-hidden="true" className="text-red-500">*</span></label>
                  <input type="number" name="price" id="price" value={currentProduct.price || ''} onChange={handleInputChange} step="0.01" min="0" required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                </div>
                <div>
                  <label htmlFor="stock" className="block text-sm font-medium text-slate-700">Кількість на складі <span aria-hidden="true" className="text-red-500">*</span></label>
                  <input type="number" name="stock" id="stock" value={currentProduct.stock || ''} onChange={handleInputChange} min="0" required aria-required="true" className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
                </div>
              </div>
              */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">Опис</label>
                <textarea name="description" id="description" value={currentProduct.description || ''} onChange={handleInputChange} rows={3} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2" />
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isLoadingDescription || !currentProduct.name || !currentProduct.category}
                  className="flex items-center text-sm bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-3 rounded-md shadow-sm transition-colors disabled:opacity-50"
                  aria-label="Згенерувати опис товару за допомогою ШІ"
                >
                  {isLoadingDescription ? <SpinnerIcon className="w-4 h-4 mr-2" /> : <SparklesIcon className="w-4 h-4 mr-2" />}
                  Згенерувати ШІ
                </button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors">
                  {editingProduct ? 'Зберегти зміни' : 'Додати товар'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Product Modal */}
      {isViewModalOpen && currentProduct && currentProduct.id && (
        <div role="dialog" aria-modal="true" aria-labelledby={`view-product-modal-title-${currentProduct.id}`} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 id={`view-product-modal-title-${currentProduct.id}`} className="text-lg font-semibold">{currentProduct.name}</h3>
              <button onClick={closeModal} aria-label="Закрити модальне вікно"><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
            <div className="space-y-3">
              <img src={(currentProduct as Product).imageUrl || `https://picsum.photos/seed/${currentProduct.id}/300/300`} alt={currentProduct.name} className="w-full h-auto rounded-md object-cover mb-3" />
              <p><span className="font-semibold text-slate-600">Категорія:</span> {currentProduct.category}</p>
              <p><span className="font-semibold text-slate-600">Ціна:</span> ${currentProduct.price?.toFixed(2)}</p>
              {/* <p><span className="font-semibold text-slate-600">Кількість на складі:</span> {currentProduct.stock}</p> Removed stock display */}
              <p className="font-semibold text-slate-600">Опис:</p>
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md">{currentProduct.description || 'Опис відсутній.'}</p>
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