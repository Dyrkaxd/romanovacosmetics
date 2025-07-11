
import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { logoBase64 } from '../assets/logo';

const LoginPage: React.FC = () => {
  const { signIn, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginSuccess = async (credentialResponse: CredentialResponse) => {
    setLoginError(null);
    try {
      const isAuthorized = await signIn(credentialResponse);

      if (isAuthorized) {
        navigate('/', { replace: true });
      } else {
        // This case is for when the user is authenticated with Google but not found in our database (admins/managers).
        // The auth context already handles logging out.
        setLoginError('Ваш обліковий запис Google автентифіковано, але не авторизовано для доступу до цієї програми. Будь ласка, зверніться до адміністратора.');
      }
    } catch (error: any) {
        console.error('Login process failed after Google success:', error);
        // This check is specifically for the HTML response error
        if (error instanceof SyntaxError && error.message.includes('not valid JSON')) {
            setLoginError('Помилка конфігурації сервера. Не вдалося зв\'язатися з API. Перевірте, що файл `netlify.toml` налаштовано правильно.');
        } else {
            setLoginError(error.message || 'Сталася невідома помилка під час входу.');
        }
    }
  };

  const handleLoginError = () => {
    console.error('Помилка входу через Google');
    setLoginError('Не вдалося увійти через Google. Будь ласка, спробуйте ще раз. Перевірте, чи не блокує ваш браузер сторонні файли cookie або вікна входу.');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="p-8 sm:p-10 bg-white shadow-lg rounded-2xl text-center max-w-md w-full border border-slate-200">
        <div className="mb-8">
           <img src={logoBase64} alt="Romanova Cosmetics Logo" className="w-24 h-24 mx-auto" />
           <h1 className="text-3xl font-bold tracking-tight text-slate-800 mt-4">ROMANOVA</h1>
           <p className="text-slate-500 tracking-widest text-sm uppercase font-medium">Cosmetics</p>
           <p className="text-slate-600 mt-6 text-base">Увійдіть, щоб продовжити до панелі керування</p>
        </div>
        
        {loginError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm" role="alert">
            {loginError}
          </div>
        )}

        <div className="flex justify-center">
            {isLoadingAuth ? (
              <div className="h-[40px] flex items-center justify-center text-slate-500">Завантаження...</div>
            ) : (
              <GoogleLogin
                onSuccess={handleLoginSuccess}
                onError={handleLoginError}
                useOneTap
                shape="rectangular"
                logo_alignment="left"
                width="300px" 
                locale="uk"
                theme="outline"
              />
            )}
        </div>
        
        <div className="mt-6 text-xs text-slate-500 bg-slate-100 p-3 rounded-lg text-left">
            <p><span className="font-semibold">Проблеми з входом?</span> Переконайтеся, що ваш браузер або блокувальники реклами не блокують спливаючі вікна чи сторонні сервіси входу.</p>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          Використовуючи цей сервіс, ви погоджуєтеся з Умовами використання та Політикою конфіденційності Google.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;