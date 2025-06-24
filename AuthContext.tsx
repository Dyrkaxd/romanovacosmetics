import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { AuthenticatedUser, ManagedUser } from './types'; // Import ManagedUser
import { googleLogout, CredentialResponse } from '@react-oauth/google';
import { jwtDecode, type JwtPayload } from 'jwt-decode';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoadingAuth: boolean;
  signIn: (credentialResponse: CredentialResponse) => boolean; // Returns true if authorized for this app
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'samsonenkoroma@gmail.com'; // Define your admin email here
const MANAGED_USERS_STORAGE_KEY = 'ecomDashManagedUsers'; // Key for managed users

interface CustomTokenPayload extends JwtPayload {
  email: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null); // Initialize user as null
  const [isLoadingAuth, setIsLoadingAuth] = useState(false); // Can be true initially if checking persisted session

  const signIn = useCallback((credentialResponse: CredentialResponse): boolean => {
    setIsLoadingAuth(true);
    if (credentialResponse.credential) {
      try {
        const decodedToken = jwtDecode<CustomTokenPayload>(credentialResponse.credential);
        const userEmail = decodedToken.email;

        const adminUserData: AuthenticatedUser = {
          email: userEmail,
          name: decodedToken.name || `${decodedToken.given_name || ''} ${decodedToken.family_name || ''}`.trim() || 'Адміністратор',
          picture: decodedToken.picture,
          role: 'admin',
        };

        const managerUserData: AuthenticatedUser = {
          email: userEmail,
          name: decodedToken.name || `${decodedToken.given_name || ''} ${decodedToken.family_name || ''}`.trim() || 'Менеджер',
          picture: decodedToken.picture,
          role: 'manager',
        };

        if (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setUser(adminUserData);
          setIsLoadingAuth(false);
          return true;
        } else {
          // Check if the user is a managed user
          const storedManagedUsers = localStorage.getItem(MANAGED_USERS_STORAGE_KEY);
          const managedUsersList: ManagedUser[] = storedManagedUsers ? JSON.parse(storedManagedUsers) : [];
          
          const isManagedUser = managedUsersList.some(mu => mu.email.toLowerCase() === userEmail.toLowerCase());

          if (isManagedUser) {
            setUser(managerUserData);
            setIsLoadingAuth(false);
            console.log("Logged in as manager:", managerUserData);
            return true;
          } else {
            console.warn(`User ${userEmail} authenticated with Google but is not authorized for this application.`);
            setUser(null); // Explicitly set user to null if not admin and not a managed user
            setIsLoadingAuth(false);
            return false; // Not authorized for this specific app
          }
        }
      } catch (error) {
        console.error("Помилка розкодування токена:", error);
        setUser(null); // Set user to null on error
        setIsLoadingAuth(false);
        return false;
      }
    } else {
      console.error("Credential не знайдено у відповіді.");
      setUser(null); // Set user to null if no credential
      setIsLoadingAuth(false);
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    googleLogout(); // Clear Google session
    setUser(null); // Reset to a fully logged-out state
    setIsLoadingAuth(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoadingAuth, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth необхідно використовувати всередині AuthProvider');
  }
  return context;
};