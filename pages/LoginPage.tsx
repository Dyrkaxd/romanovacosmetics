
import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    signIn(credentialResponse);
    navigate('/', { replace: true });
  };

  const handleLoginError = () => {
    console.error('Помилка входу через Google');
    // Можна додати сповіщення для користувача тут
    alert('Не вдалося увійти через Google. Будь ласка, спробуйте ще раз.');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="p-8 bg-white shadow-xl rounded-lg text-center max-w-md w-full">
        <div className="mb-8">
           <span className="text-6xl" role="img" aria-label="Shop Icon">🛍️</span>
           <h1 className="text-3xl font-bold text-slate-800 mt-2">Менеджер ел. комерції</h1>
           <p className="text-slate-600 mt-1">Увійдіть, щоб продовжити</p>
        </div>
        
        <GoogleLogin
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          useOneTap
          shape="rectangular"
          logo_alignment="left"
          width="300px" // Adjust width as needed
          locale="uk"
        />
        <p className="text-xs text-slate-500 mt-8">
          Використовуючи цей сервіс, ви погоджуєтеся з Умовами використання та Політикою конфіденційності Google.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
