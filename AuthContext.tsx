
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { AuthenticatedUser } from './types';
import { googleLogout, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoadingAuth: boolean; // To handle initial auth state check if needed in future
  signIn: (credentialResponse: CredentialResponse) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false); // Initially false, no persistent login check

  const signIn = useCallback((credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      try {
        const decodedToken: { email: string, name?: string, picture?: string, given_name?: string, family_name?: string } = jwtDecode(credentialResponse.credential);
        const userData: AuthenticatedUser = {
          email: decodedToken.email,
          name: decodedToken.name || `${decodedToken.given_name || ''} ${decodedToken.family_name || ''}`.trim() || 'Користувач',
          picture: decodedToken.picture,
        };
        setUser(userData);
      } catch (error) {
        console.error("Помилка розкодування токена:", error);
        setUser(null); // Ensure user is null if token is invalid
      }
    } else {
      console.error("Credential не знайдено у відповіді.");
      setUser(null);
    }
  }, []);

  const signOut = useCallback(() => {
    googleLogout();
    setUser(null);
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
