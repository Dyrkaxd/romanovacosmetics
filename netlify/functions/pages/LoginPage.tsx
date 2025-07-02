import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { logoBase64 } from '../assets/logo';

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLoginSuccess = async (credentialResponse: CredentialResponse) => {
    const isAuthorized = await signIn(credentialResponse);

    if (isAuthorized) {
      navigate('/', { replace: true });
    } else {
      // This means Google authentication was successful, but the user is not
      // an admin and not in the managed users list.
      alert('Ваш обліковий запис Google автентифіковано, але не авторизовано для доступу до цієї програми. Будь ласка, зверніться до адміністратора.');
    }
  };

  const handleLoginError = () => {
    console.error('Помилка входу через Google');
    alert('Не вдалося увійти через Google. Будь ласка, спробуйте ще раз або перевірте налаштування вашого облікового запису Google.');
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
        
        <div className="flex justify-center">
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
        </div>

        <p className="text-xs text-slate-400 mt-10">
          Використовуючи цей сервіс, ви погоджуєтеся з Умовами використання та Політикою конфіденційності Google.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;