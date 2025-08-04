
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { AuthenticatedUser } from './types'; 
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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const performAuthCheck = useCallback(async (jwt: string): Promise<AuthenticatedUser | null> => {
    if (!jwt) throw new Error("No token provided for auth check.");

    const decodedToken = jwtDecode<CustomTokenPayload>(jwt);
    if (decodedToken.exp && decodedToken.exp * 1000 < Date.now()) {
        throw new Error('Token has expired');
    }

    const response = await fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${jwt}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      const errorData = await response.json().catch(() => ({ message: 'Unauthorized or Forbidden' }));
      throw new Error(errorData.message);
    }
    
    if (!response.ok) {
        let errorMessage = `Failed to verify user role. Status: ${response.status} ${response.statusText}`;
        try {
            const errData = await response.json();
            errorMessage = errData.message || errorMessage;
        } catch (e) { 
            if(e instanceof SyntaxError){
                throw new SyntaxError(`Server Configuration Error: The response from the API was not valid JSON. This often happens if the API route is not correctly configured on the server. Please check your rewrite rules (e.g., in netlify.toml). Response text: ${await response.text()}`);
            }
         }
        throw new Error(errorMessage);
    }

    const authorizedUser: AuthenticatedUser | null = await response.json();
    
    if (authorizedUser) {
       // Enrich with details from JWT if not present
      authorizedUser.name = authorizedUser.name || decodedToken.name || `${decodedToken.given_name || ''} ${decodedToken.family_name || ''}`.trim() || 'Користувач';
      authorizedUser.picture = decodedToken.picture;
      return authorizedUser;
    }
    
    return null; // Not an admin, not a managed user
  }, []);

  // Effect for session restore from localStorage
  useEffect(() => {
    const restoreSession = async () => {
        const storedToken = localStorage.getItem('authToken');
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
                localStorage.removeItem('authToken');
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
      throw new Error("Не знайдено облікових даних у відповіді Google.");
    }

    const jwt = credentialResponse.credential;

    try {
        const userProfile = await performAuthCheck(jwt);
        if (userProfile) {
            setUser(userProfile);
            setToken(jwt);
            localStorage.setItem('authToken', jwt);
            return true;
        } else {
            console.warn(`User authenticated with Google but is not authorized for this application.`);
            googleLogout();
            setUser(null);
            setToken(null);
            localStorage.removeItem('authToken');
            return false;
        }
    } catch (error) {
        console.error("Sign in process failed:", error);
        googleLogout();
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
        // Re-throw the error so the calling component can handle it
        throw error;
    } finally {
        setIsLoadingAuth(false);
    }
  }, [performAuthCheck]);

  const signOut = useCallback(() => {
    googleLogout();
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
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
