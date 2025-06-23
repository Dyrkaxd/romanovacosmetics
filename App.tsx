
import React from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import CustomersPage from './pages/CustomersPage';
import LoginPage from './pages/LoginPage';
import { SpinnerIcon } from './components/Icons';

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
    case '/login':
      return 'Вхід до системи';
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
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64"> {/* Adjust ml to match sidebar width */}
        <Header title={pageTitle} />
        <main className="flex-1 p-6 overflow-y-auto bg-slate-100">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/settings" element={<div className="text-xl p-4 bg-white rounded-lg shadow">Сторінка налаштувань (Не реалізовано)</div>} />
            <Route path="*" element={<Navigate to="/" replace />} /> {/* Redirect unmatched to dashboard */}
          </Routes>
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!isLoadingAuth) {
      if (user && location.pathname === '/login') {
        navigate('/', { replace: true });
      } else if (!user && location.pathname !== '/login') {
        // Allow access to /login if not authenticated
        // This navigation will be handled by the Routes structure below
      }
    }
  }, [user, isLoadingAuth, location.pathname, navigate]);

  if (isLoadingAuth) {
    return <div className="flex items-center justify-center h-screen bg-slate-100"><SpinnerIcon className="w-12 h-12 text-indigo-600" /></div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={user ? <MainAppLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  // ВАЖЛИВО: Замініть 'YOUR_GOOGLE_CLIENT_ID_REPLACE_ME' на ваш справжній Google Client ID
  const googleClientId = 207911989595-0d5jo71ibh1q3rr6qg9gdai9j8v8b75i.apps.googleusercontent.com; 

  if (googleClientId === "YOUR_GOOGLE_CLIENT_ID_REPLACE_ME") {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', textAlign: 'center', backgroundColor: '#f0f0f0', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', lineHeight: '1.6' }}>
        <h1 style={{ color: '#333', fontSize: '2em' }}>Потрібне налаштування Google Sign-In</h1>
        <p style={{ color: '#555', fontSize: '1.2em', maxWidth: '600px', margin: '20px auto' }}>
          Будь ласка, замініть <code>"YOUR_GOOGLE_CLIENT_ID_REPLACE_ME"</code> у файлі <code>App.tsx</code> (у компоненті <code>App</code>) на ваш справжній Google Client ID.
        </p>
        <p style={{ color: '#777', fontSize: '1em' }}>
          Ви можете отримати Client ID, створивши "OAuth 2.0 Client ID" у <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{color: '#007bff'}}>Google Cloud Console</a>.
        </p>
         <p style={{ color: '#777', fontSize: '1em', marginTop: '10px' }}>
          Переконайтеся, що ви додали ваш домен розгортання (наприклад, Netlify URL) та <code>http://localhost:PORT</code> (для локальної розробки) до "Authorized JavaScript origins" та "Authorized redirect URIs" (якщо потрібно для вашого типу клієнта) у налаштуваннях вашого Client ID.
        </p>
        <p style={{ color: '#c00', fontSize: '1em', marginTop: '20px', fontWeight: 'bold' }}>
          Без цього авторизація через Google не працюватиме.
        </p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
