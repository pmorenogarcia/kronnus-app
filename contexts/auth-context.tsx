import React, { createContext, useContext, useEffect, useState } from 'react';

import { clearStoredToken, getStoredToken } from '@/src/api';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (token: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStoredToken()
      .then((stored) => {
        if (stored) setToken(stored);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function signIn(newToken: string) {
    setToken(newToken);
  }

  async function signOut() {
    await clearStoredToken();
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
