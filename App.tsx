import React, { useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './AuthContext'; 
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage'; // Import LoginPage


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
    default:
      if (normalizedPathname.startsWith('/orders/')) return 'Деталі замовлення';
      if (normalizedPathname.startsWith('/products/')) return 'Деталі товару';
      if (normalizedPathname.startsWith('/customers/')) return 'Деталі клієнта';
      return 'Менеджер ел. комерції';
  }
};

const MainAppLayout: React.FC = () => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="flex h-screen">
      <Sidebar isOpenOnMobile={isMobileSidebarOpen} toggleMobileSidebar={toggleMobileSidebar} />
      <div className={`flex-1 flex flex-col md:ml-64 transition-all duration-300 ease-in-out`}> {/* Adjust ml for medium screens and up */}
        <Header title={pageTitle} onToggleMobileSidebar={toggleMobileSidebar} />
        <main className="flex-1 p-4 md:px-0 md:py-4 overflow-y-auto bg-slate-100"> {/* Змінено md:px-2 на md:px-0 */}
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} /> {/* Redirect unknown paths within app to dashboard */}
          </Routes>
        </main>
      </div>
       {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={toggleMobileSidebar}
          aria-hidden="true"
        ></div>
      )}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <p className="text-slate-700 text-lg">Завантаження автентифікації...</p>
        {/* You can replace this with a spinner component if you have one */}
      </div>
    );
  }

  return (
    <Routes>
      {user ? (
        // User is authenticated, show main app layout
        <Route path="/*" element={<MainAppLayout />} />
      ) : (
        // User is not authenticated, show login page and redirect all other paths to login
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  );
};

const App: React.FC = () => {
  const googleClientId = "207911989595-0d5jo71ibh1q3rr6qg9gdai9j8v8b75i.apps.googleusercontent.com"; 

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;