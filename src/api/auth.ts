import * as SecureStore from 'expo-secure-store';

import { User } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
export const AUTH_TOKEN_KEY = 'auth_token';

export class AuthError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export async function loginUser(identifier: string, password: string): Promise<{ token: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
  } catch {
    throw new AuthError('Could not connect to the server. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new AuthError(
      response.status === 400 || response.status === 401
        ? 'Invalid email/username or password.'
        : 'Something went wrong. Please try again.',
      response.status,
    );
  }

  const data = (await response.json()) as { token: string };
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
  return { token: data.token };
}

export async function getMe(token: string): Promise<User> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AuthError('Could not connect to the server. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new AuthError('Failed to fetch user profile.', response.status);
  }

  const data = (await response.json()) as { user_id: string; email: string };
  return { id: data.user_id, email: data.email };
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function clearStoredToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
