import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { AuthenticatedUser, ManagedUser } from './types'; 
import { googleLogout, CredentialResponse } from '@react-oauth/google';
import { jwtDecode, type JwtPayload } from 'jwt-decode';

interface AuthContextType {
  user: AuthenticatedUser | null;
  token: string | null; 
  isLoadingAuth: boolean;
  signIn: (credentialResponse: CredentialResponse) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'samsonenkoroma@gmail.com';
const API_BASE_URL = '/api';

interface CustomTokenPayload extends JwtPayload {
  email: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('authToken'));
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const performAuthCheck = useCallback(async (jwt: string): Promise<AuthenticatedUser | null> => {
    if (!jwt) throw new Error("No token provided for auth check.");

    const decodedToken = jwtDecode<CustomTokenPayload>(jwt);
    if (decodedToken.exp && decodedToken.exp * 1000 < Date.now()) {
        throw new Error('Token has expired');
    }
    const userEmail = decodedToken.email.toLowerCase();

    const baseUserData: AuthenticatedUser = {
        email: userEmail,
        name: decodedToken.name || `${decodedToken.given_name || ''} ${decodedToken.family_name || ''}`.trim() || 'Користувач',
        picture: decodedToken.picture,
    };

    if (userEmail === ADMIN_EMAIL.toLowerCase()) {
        return { ...baseUserData, role: 'admin', name: baseUserData.name || 'Адміністратор' };
    }

    const response = await fetch(`${API_BASE_URL}/managedUsers?email=${encodeURIComponent(userEmail)}`, {
      headers: {
        'Authorization': `Bearer ${jwt}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized: Token is invalid or does not match user.');
    }
    
    if (!response.ok) {
        let errorMessage = `Failed to fetch managed user status. Status: ${response.status} ${response.statusText}`;
        try {
            const errData = await response.json();
            errorMessage = errData.message || errorMessage;
        } catch (e) { /* ignore json parse error */ }
        throw new Error(errorMessage);
    }

    const managedUserEntry: ManagedUser | null = await response.json();

    if (managedUserEntry && managedUserEntry.email === userEmail) {
        return { ...baseUserData, role: 'manager', name: baseUserData.name || managedUserEntry.name };
    }
    
    return null; // Not an admin, not a managed user
  }, []);

  // Effect for session restore from sessionStorage
  useEffect(() => {
    const restoreSession = async () => {
        const storedToken = sessionStorage.getItem('authToken');
        if (storedToken) {
            try {
                const userProfile = await performAuthCheck(storedToken);
                if (userProfile) {
                    setUser(userProfile);
                    setToken(storedToken);
                } else {
                    throw new Error("User no longer authorized.");
                }
            } catch (error) {
                console.error("Session restore failed:", error);
                // Clear invalid session
                setUser(null);
                setToken(null);
                sessionStorage.removeItem('authToken');
            }
        }
        setIsLoadingAuth(false);
    };
    restoreSession();
  }, [performAuthCheck]);


  const signIn = useCallback(async (credentialResponse: CredentialResponse): Promise<boolean> => {
    setIsLoadingAuth(true);
    if (!credentialResponse.credential) {
      console.error("Credential не знайдено у відповіді.");
      setIsLoadingAuth(false);
      return false;
    }

    const jwt = credentialResponse.credential;

    try {
        const userProfile = await performAuthCheck(jwt);
        if (userProfile) {
            setUser(userProfile);
            setToken(jwt);
            sessionStorage.setItem('authToken', jwt);
            return true;
        } else {
            console.warn(`User authenticated with Google but is not authorized for this application.`);
            googleLogout();
            setUser(null);
            setToken(null);
            sessionStorage.removeItem('authToken');
            return false;
        }
    } catch (error) {
        console.error("Sign in process failed:", error);
        googleLogout();
        setUser(null);
        setToken(null);
        sessionStorage.removeItem('authToken');
        return false;
    } finally {
        setIsLoadingAuth(false);
    }
  }, [performAuthCheck]);

  const signOut = useCallback(() => {
    googleLogout();
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('authToken');
    // Optionally, redirect to login page after sign out
    // window.location.hash = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoadingAuth, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
