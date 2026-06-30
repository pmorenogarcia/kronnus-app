import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '@/contexts/auth-context';

// ── Firebase mock ─────────────────────────────────────────────────────────────
let capturedListener: ((user: unknown) => Promise<void>) | null = null;
const mockSignOut = jest.fn();

jest.mock('@react-native-firebase/auth', () => () => ({
  onIdTokenChanged: (cb: (user: unknown) => Promise<void>) => {
    capturedListener = cb;
    return () => {
      capturedListener = null;
    };
  },
  signOut: mockSignOut,
}));

// ── API mock ──────────────────────────────────────────────────────────────────
const mockGetMe = jest.fn();

jest.mock('@/src/api', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.name = 'AuthError';
      this.statusCode = code;
    }
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedListener = null;
});

it('starts as loading with no token', async () => {
  const { result } = await renderHook(() => useAuth(), { wrapper });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.token).toBeNull();
  expect(result.current.user).toBeNull();
});

it('sets token and user when Firebase user is present', async () => {
  const fakeFirebaseUser = {
    getIdToken: jest.fn().mockResolvedValue('firebase-id-token'),
  };
  mockGetMe.mockResolvedValue({ id: 'u1', email: 'a@b.com', username: 'tester' });

  const { result } = await renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await capturedListener!(fakeFirebaseUser);
  });

  expect(result.current.isLoading).toBe(false);
  expect(result.current.token).toBe('firebase-id-token');
  expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.com', username: 'tester' });
  expect(result.current.isAuthenticated).toBe(true);
  expect(mockGetMe).toHaveBeenCalledWith('firebase-id-token');
});

it('clears token and user when Firebase user is null', async () => {
  const { result } = await renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await capturedListener!(null);
  });

  expect(result.current.isLoading).toBe(false);
  expect(result.current.token).toBeNull();
  expect(result.current.user).toBeNull();
  expect(result.current.isAuthenticated).toBe(false);
});

it('calls auth().signOut() and clears state when getMe rejects with 401', async () => {
  const fakeFirebaseUser = {
    getIdToken: jest.fn().mockResolvedValue('firebase-id-token'),
  };
  const { AuthError } = jest.requireMock('@/src/api') as {
    AuthError: new (msg: string, code: number) => Error & { statusCode: number };
  };
  mockGetMe.mockRejectedValue(new AuthError('unauthorized', 401));

  const { result } = await renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await capturedListener!(fakeFirebaseUser);
  });

  expect(mockSignOut).toHaveBeenCalled();
  expect(result.current.token).toBeNull();
  expect(result.current.user).toBeNull();
  expect(result.current.isLoading).toBe(false);
});

it('keeps the token and stays authenticated when getMe fails with a non-auth error', async () => {
  const fakeFirebaseUser = {
    getIdToken: jest.fn().mockResolvedValue('firebase-id-token'),
  };
  const { AuthError } = jest.requireMock('@/src/api') as {
    AuthError: new (msg: string, code: number) => Error & { statusCode: number };
  };
  mockGetMe.mockRejectedValue(new AuthError('internal error', 500));

  const { result } = await renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await capturedListener!(fakeFirebaseUser);
  });

  expect(mockSignOut).not.toHaveBeenCalled();
  expect(result.current.token).toBe('firebase-id-token');
  expect(result.current.user).toBeNull();
  expect(result.current.isAuthenticated).toBe(true);
  expect(result.current.isLoading).toBe(false);
});

it('signOut calls auth().signOut()', async () => {
  const { result } = await renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await result.current.signOut();
  });

  expect(mockSignOut).toHaveBeenCalled();
});
