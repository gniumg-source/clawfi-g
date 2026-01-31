'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { createClawFiClient, type ClawFiClient, type User } from '@clawfi/sdk';

interface AuthContextType {
  user: User | null;
  client: ClawFiClient | null;
  token: string | null;
  nodeUrl: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within Providers');
  }
  return context;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [client, setClient] = useState<ClawFiClient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize client
    const storedToken = localStorage.getItem('clawfi_token');
    if (storedToken) {
      setToken(storedToken);
    }
    const newClient = createClawFiClient({
      baseUrl: API_URL,
      authToken: storedToken || undefined,
    });
    setClient(newClient);

    // Check if we have a valid session
    if (storedToken) {
      newClient
        .getMe()
        .then((userData) => {
          setUser(userData);
          newClient.connectWebSocket();
        })
        .catch(() => {
          localStorage.removeItem('clawfi_token');
          newClient.clearAuthToken();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      newClient.disconnectWebSocket();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!client) throw new Error('Client not initialized');

    const response = await client.login({ email, password });
    localStorage.setItem('clawfi_token', response.token);
    setToken(response.token);
    client.setAuthToken(response.token);
    
    const userData = await client.getMe();
    setUser(userData);
    client.connectWebSocket();
  };

  const logout = () => {
    localStorage.removeItem('clawfi_token');
    setToken(null);
    if (client) {
      client.clearAuthToken();
      client.disconnectWebSocket();
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        client,
        token,
        nodeUrl: API_URL,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

