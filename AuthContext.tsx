import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { AuthenticatedUser, ManagedUser } from './types'; 
import { googleLogout, CredentialResponse } from '@react-oauth/google';
import { jwtDecode, type JwtPayload } from 'jwt-decode';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoadingAuth: boolean;
  signIn: (credentialResponse: CredentialResponse) => Promise<boolean>; // Returns true if authorized for this app
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'samsonenkoroma@gmail.com';
const API_BASE_URL = '/api'; // For Netlify functions

interface CustomTokenPayload extends JwtPayload {
  email: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Start true to handle initial check

  // Placeholder: Check for persisted session (e.g., from a secure cookie or localStorage if appropriate)
  // This example doesn't implement session persistence beyond Google's own session management.
  // For a real app, you might check a token here.
  useEffect(() => {
    // Simulate initial auth check (e.g., if you had a persisted session token)
    // For now, just set loading to false after a brief moment if no user is found.
    // A real implementation might involve an API call to validate a session.
    const timer = setTimeout(() => {
      if (!user) { // If no user set by a persisted session check (not implemented here)
        setIsLoadingAuth(false);
      }
    }, 500); // Artificial delay, replace with actual session check
    return () => clearTimeout(timer);
  }, [user]);


  const signIn = useCallback(async (credentialResponse: CredentialResponse): Promise<boolean> => {
    setIsLoadingAuth(true);
    if (credentialResponse.credential) {
      try {
        const decodedToken = jwtDecode<CustomTokenPayload>(credentialResponse.credential);
        const userEmail = decodedToken.email.toLowerCase();

        const baseUserData = {
          email: userEmail,
          name: decodedToken.name || `${decodedToken.given_name || ''} ${decodedToken.family_name || ''}`.trim() || 'Користувач',
          picture: decodedToken.picture,
        };

        if (userEmail === ADMIN_EMAIL.toLowerCase()) {
          setUser({ ...baseUserData, role: 'admin', name: baseUserData.name || 'Адміністратор' });
          setIsLoadingAuth(false);
          return true;
        } else {
          // Check if the user is a managed user from Supabase
          try {
            const response = await fetch(`${API_BASE_URL}/managed-users?email=${encodeURIComponent(userEmail)}`);
            if (!response.ok) {
              console.error('Failed to fetch managed user status:', response.statusText);
              // Fallback: treat as not authorized if API fails, or handle error differently
              setUser(null);
              setIsLoadingAuth(false);
              return false;
            }
            const managedUserEntry: ManagedUser | null = await response.json();

            if (managedUserEntry && managedUserEntry.email === userEmail) {
              setUser({ ...baseUserData, role: 'manager', name: baseUserData.name || managedUserEntry.name });
              setIsLoadingAuth(false);
              return true;
            } else {
              console.warn(`User ${userEmail} authenticated with Google but is not authorized for this application.`);
              setUser(null);
              setIsLoadingAuth(false);
              return false;
            }
          } catch (apiError) {
            console.error("API error checking managed user:", apiError);
            setUser(null);
            setIsLoadingAuth(false);
            return false;
          }
        }
      } catch (error) {
        console.error("Помилка розкодування токена:", error);
        setUser(null);
        setIsLoadingAuth(false);
        return false;
      }
    } else {
      console.error("Credential не знайдено у відповіді.");
      setUser(null);
      setIsLoadingAuth(false);
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    googleLogout(); 
    setUser(null); 
    setIsLoadingAuth(false);
    // Optionally, clear any other app-specific session storage here
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
