import React, { createContext, useContext, useEffect, useState } from 'react';

import { AuthError, clearStoredToken, getMe, getStoredToken } from '@/src/api';
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
        if (stored) {
          setToken(stored);
          // isLoading stays true — cleared after getMe resolves below
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => setIsLoading(false)); // SecureStore read failure → treat as no token
  }, []);

  // Fetch user profile whenever token is set; clears stale tokens on 401/403
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    getMe(token)
      .then(setUser)
      .catch((err: unknown) => {
        // Expired or revoked token — sign out so the user reaches the login screen cleanly
        if (err instanceof AuthError && (err.statusCode === 401 || err.statusCode === 403)) {
          void clearStoredToken();
          setToken(null);
        }
        // Network/server errors: keep token, user stays null (stay "authenticated" locally)
      })
      .finally(() => setIsLoading(false));
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
