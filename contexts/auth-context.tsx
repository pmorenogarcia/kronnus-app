import React, { createContext, useContext, useEffect, useState } from 'react';

import { clearStoredToken, getMe, getStoredToken } from '@/src/api';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (token: string) => void;
  signOut: () => Promise<void>;
  updateUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStoredToken()
      .then((stored) => {
        if (stored) setToken(stored);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch user profile whenever token is set
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    getMe(token)
      .then(setUser)
      .catch(() => {});
  }, [token]);

  function signIn(newToken: string) {
    setToken(newToken);
  }

  async function signOut() {
    await clearStoredToken();
    setToken(null);
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated: !!token, isLoading, signIn, signOut, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
