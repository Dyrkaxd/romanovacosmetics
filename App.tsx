

import React, { useState, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './AuthContext'; 
import { ThemeProvider } from './ThemeContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Lazy load all pages for code splitting
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.tsx'));
const ManagerDashboardPage = React.lazy(() => import('./pages/ManagerDashboardPage.tsx'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage.tsx'));
const ProductDetailPage = React.lazy(() => import('./pages/ProductDetailPage.tsx'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage.tsx'));
const CustomersPage = React.lazy(() => import('./pages/CustomersPage.tsx'));
const CustomerDetailPage = React.lazy(() => import('./pages/CustomerDetailPage.tsx'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage.tsx'));
const LoginPage = React.lazy(() => import('./pages/LoginPage.tsx'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage.tsx'));
const ManagerReportPage = React.lazy(() => import('./pages/ManagerReportPage.tsx'));
const ExpensesPage = React.lazy(() => import('./pages/ExpensesPage.tsx'));
const InvoiceViewPage = React.lazy(() => import('./pages/InvoiceViewPage.tsx'));
const WarehousePage = React.lazy(() => import('./pages/WarehousePage.tsx'));
const HelpPage = React.lazy(() => import('./pages/HelpPage.tsx'));


const getPageTitle = (pathname: string, role?: 'admin' | 'manager'): string => {
  const normalizedPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  if (normalizedPathname.startsWith('/products/')) return 'Деталі товару';
  if (normalizedPathname.startsWith('/customers/')) return 'Деталі клієнта';

  switch (normalizedPathname) {
    case '': 
    case '/':
      if (role === 'manager') return 'Мій огляд';
      return 'Панель керування';
    case '/products':
      return 'Керування товарами';
    case '/warehouse':
      return 'Керування складом';
    case '/orders':
      return 'Керування замовленнями';
    case '/customers':
      return 'Керування клієнтами';
    case '/reports':
      return 'Звіти';
    case '/reports/managers':
      return 'Звіт по менеджерах';
    case '/expenses':
      return 'Керування витратами';
    case '/settings':
      return 'Налаштування';
    case '/help':
      return 'Довідка';
    default:
      if (normalizedPathname.startsWith('/orders/')) return 'Деталі замовлення';
      if (normalizedPathname.startsWith('/invoice/')) return 'Рахунок-фактура';
      return 'Менеджер ел. комерції';
  }
};

const PageLoader: React.FC = () => (
    <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const MainAppLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const pageTitle = getPageTitle(location.pathname, user?.role);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const isAdmin = user?.role === 'admin';

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
        const newState = !prev;
        localStorage.setItem('sidebarCollapsed', String(newState));
        return newState;
    });
  };

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar 
        isOpenOnMobile={isMobileSidebarOpen} 
        toggleMobileSidebar={toggleMobileSidebar}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={toggleSidebarCollapse}
      />
      <div className={`flex-1 flex flex-col ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} transition-all duration-300 ease-in-out`}>
        <Header title={pageTitle} onToggleMobileSidebar={toggleMobileSidebar} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {isAdmin ? (
                <Route path="/" element={<DashboardPage />} />
              ) : (
                <Route path="/" element={<ManagerDashboardPage />} />
              )}
              {isAdmin && <Route path="/reports" element={<ReportsPage />} />}
              {isAdmin && <Route path="/reports/managers" element={<ManagerReportPage />} />}
              {isAdmin && <Route path="/expenses" element={<ExpensesPage />} />}
              {isAdmin && <Route path="/products" element={<ProductsPage />} />}
              {isAdmin && <Route path="/products/:productId" element={<ProductDetailPage />} />}
              {isAdmin && <Route path="/warehouse" element={<WarehousePage />} />}
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
              {/* Redirect any unknown paths to the user's appropriate home page */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
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

  useEffect(() => {
    if (user) {
        document.title = user.role === 'admin' ? 'Romanova Admin' : 'Romanova Manager';
    } else {
        document.title = 'Romanova Cosmetics';
    }
  }, [user]);

  if (isLoadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 dark:text-slate-300 text-lg mt-4 font-medium">Завантаження автентифікації...</p>
      </div>
    );
  }

  const CenteredPageLoader = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
         <p className="text-slate-600 dark:text-slate-300 text-lg mt-4 font-medium">Завантаження...</p>
    </div>
  );

  return (
    <Suspense fallback={<CenteredPageLoader />}>
      <Routes>
        <Route path="/invoice/:orderId" element={<InvoiceViewPage />} />
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
    </Suspense>
  );
};

const App: React.FC = () => {
  const googleClientId = "207911989595-0d5jo71ibh1q3rr6qg9gdai9j8v8b75i.apps.googleusercontent.com";

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;