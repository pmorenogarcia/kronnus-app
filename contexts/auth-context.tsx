import auth from '@react-native-firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { AuthError, getMe } from '@/src/api';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updateUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onIdTokenChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          // getMe() re-fetches its own token via getToken() rather than using
          // idToken above — by the time onIdTokenChanged fires, currentUser
          // already reflects firebaseUser, so this returns the same token.
          const profile = await getMe();
          setUser(profile);
        } else {
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        if (err instanceof AuthError && (err.statusCode === 401 || err.statusCode === 403)) {
          // Genuinely invalid/expired credentials — sign out for real.
          await auth().signOut();
          setToken(null);
          setUser(null);
        }
        // Network failures or backend errors (e.g. 5xx) are transient — keep the
        // Firebase session and token so the user isn't bounced to the login screen
        // by a server hiccup. `user` stays null until the next token refresh
        // succeeds in fetching the profile.
      } finally {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  async function signOut() {
    await auth().signOut();
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated: !!token, isLoading, signOut, updateUser }}
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
