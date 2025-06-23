import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import CustomersPage from './pages/CustomersPage';
// import LoginPage from './pages/LoginPage'; // LoginPage removed
// import { AuthProvider, useAuth } from './AuthContext'; // AuthProvider and useAuth removed
// import { SpinnerIcon } from './components/Icons'; // SpinnerIcon might not be needed here anymore

const getPageTitle = (pathname: string): string => {
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  switch (normalizedPathname) {
    case '': 
    case '/':
      return 'Панель керування';
    case '/products':
      return 'Керування товарами';
    case '/orders':
      return 'Керування замовленнями';
    case '/customers':
      return 'Керування клієнтами';
    case '/settings':
      return 'Налаштування';
    // case '/login': // Login title removed
    //   return 'Login';
    default:
      if (normalizedPathname.startsWith('/orders/')) return 'Деталі замовлення';
      if (normalizedPathname.startsWith('/products/')) return 'Деталі товару';
      if (normalizedPathname.startsWith('/customers/')) return 'Деталі клієнта';
      return 'Менеджер ел. комерції';
  }
};

// ProtectedLayout removed

const AppContent: React.FC = () => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  
  // isLoadingAuth and user checks removed
  
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64"> {/* Adjust ml to match sidebar width */}
        <Header title={pageTitle} />
        <main className="flex-1 p-6 overflow-y-auto bg-slate-100">
          <Routes>
            {/* LoginPage route removed */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/settings" element={<div className="text-xl p-4 bg-white rounded-lg shadow">Сторінка налаштувань (Не реалізовано)</div>} />
            <Route path="*" element={<NavigateToDashboard />} /> {/* Simplified catch-all */}
          </Routes>
        </main>
      </div>
    </div>
  );
};

// Helper component to navigate to dashboard for any unmatched routes
const NavigateToDashboard: React.FC = () => {
  const navigate = React.useRef(useLocation().pathname !== '/' ? (window.location.hash = '#/') : null); // Use a ref to avoid re-renders if navigate changes, direct hash manipulation for simplicity here
  return null; // Or some 404 component if preferred
};


const App: React.FC = () => {
  return (
    // AuthProvider removed
    <AppContent />
  );
};

export default App;