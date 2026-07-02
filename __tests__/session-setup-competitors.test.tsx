import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import SessionSetupScreen from '@/app/session-setup';

// ── expo-router mock ──────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({
    session_id: 'sess-1',
    session_code: 'ABC123',
    session_name: 'Test Race',
    session_status: 'WAITING',
  }),
}));

// ── safe-area mock ────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ── auth mock ──────────────────────────────────────────────────────────────────
jest.mock('@/contexts', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

// ── hooks mock (socket + time sync) ─────────────────────────────────────────────
jest.mock('@/src/hooks', () => ({
  useSessionSocket: () => ({
    status: 'connected',
    lastMessage: null,
    send: jest.fn(),
  }),
  useTimeSync: () => ({
    getCorrectedTimestamp: () => Date.now(),
    offsetMs: 0,
  }),
}));

// ── API mock ──────────────────────────────────────────────────────────────────
const mockGetSessionState = jest.fn();
const mockListCompetitors = jest.fn();

jest.mock('@/src/api', () => ({
  addCompetitor: jest.fn(),
  getSessionState: (...args: unknown[]) => mockGetSessionState(...args),
  listCompetitors: (...args: unknown[]) => mockListCompetitors(...args),
  openSession: jest.fn(),
  setCheckpointRole: jest.fn(),
  SessionError: class SessionError extends Error {},
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSessionState.mockResolvedValue({ session: {}, checkpoints: [] });
  mockListCompetitors.mockResolvedValue([
    { id: 'c1', session_id: 'sess-1', display_name: 'Alice', bib_number: '1', created_at: '' },
    { id: 'c2', session_id: 'sess-1', display_name: 'Bob', bib_number: '2', created_at: '' },
  ]);
});

test('hydrates previously-added competitors from the server on mount', async () => {
  render(<SessionSetupScreen />);

  // Root cause of the bug: competitors state started as [] and was never
  // fetched from the server, so remounting this screen (e.g. navigating back
  // from Home) always showed "No competitors added yet" even though the
  // competitors were already persisted server-side.
  await waitFor(() => expect(mockListCompetitors).toHaveBeenCalledWith('ABC123'));
  await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
  expect(screen.getByText('Bob')).toBeTruthy();
  expect(screen.queryByText('No competitors added yet')).toBeNull();
});
