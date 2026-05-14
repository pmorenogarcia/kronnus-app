import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveSession, loadSession, clearSession } from '@/src/utils/sessionPersistence';
import type { PersistedSessionState } from '@/src/utils/sessionPersistence';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const sample: PersistedSessionState = {
  session_id: 'abc-123',
  session_code: 'XY9Z1A',
  session_name: 'Trail Race 2026',
  role: 'START',
  offset_ms: -42,
  session_start_ms: 1_700_000_000_000,
  is_coordinator: false,
};

beforeEach(() => AsyncStorage.clear());

test('saveSession and loadSession round-trip', async () => {
  await saveSession(sample);
  const loaded = await loadSession();
  expect(loaded).toEqual(sample);
});

test('loadSession returns null when nothing stored', async () => {
  const loaded = await loadSession();
  expect(loaded).toBeNull();
});

test('clearSession removes the value', async () => {
  await saveSession(sample);
  await clearSession();
  const loaded = await loadSession();
  expect(loaded).toBeNull();
});

test('loadSession returns null on corrupt data', async () => {
  await AsyncStorage.setItem('kronnus:active_session', '{not json}');
  const loaded = await loadSession();
  expect(loaded).toBeNull();
});
