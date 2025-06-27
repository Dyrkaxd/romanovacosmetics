import React from 'react';
import { GoogleLogin, CredentialResponse, googleLogout } from '@react-oauth/google';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { logoBase64 } from '../assets/logo';

const LoginPage: React.FC = () => {
  const { signIn, user } = useAuth(); // get user to potentially check after signIn
  const navigate = useNavigate();

  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    const isAuthorizedForApp = signIn(credentialResponse);

    if (isAuthorizedForApp) {
      navigate('/', { replace: true });
    } else {
      // This means Google authentication was successful, but the user is not
      // an admin and not in the managed users list.
      alert('Ваш обліковий запис Google автентифіковано, але не авторизовано для доступу до цієї програми. Будь ласка, зверніться до адміністратора.');
      // Optional: Clear Google's one-tap or session if you want them to pick an account again.
      // googleLogout(); 
      // Note: if user state in AuthContext becomes null, the app should already reflect an unauthed state.
    }
  };

  const handleLoginError = () => {
    console.error('Помилка входу через Google');
    alert('Не вдалося увійти через Google. Будь ласка, спробуйте ще раз або перевірте налаштування вашого облікового запису Google.');
  };

  // If a user is already somehow logged in (e.g. mock user, or previous session)
  // and visits /login, redirect them to dashboard.
  // This is optional, but common practice.
  // useEffect(() => {
  // if (user) {
  // navigate('/', { replace: true });
  // }
  // }, [user, navigate]);


  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="p-8 bg-white shadow-xl rounded-lg text-center max-w-md w-full">
        <div className="mb-8">
           <img src={logoBase64} alt="Romanova Cosmetics Logo" className="w-24 h-24 mx-auto" />
           <h1 className="text-3xl font-light tracking-[0.2em] text-slate-800 mt-4">ROMANOVA</h1>
           <p className="text-slate-500 tracking-widest text-sm uppercase">Cosmetics</p>
           <p className="text-slate-600 mt-6">Увійдіть, щоб продовжити</p>
        </div>
        
        <GoogleLogin
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          useOneTap
          shape="rectangular"
          logo_alignment="left"
          width="300px" 
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