// NOTE: AsyncStorage is used instead of the project's expo-secure-store abstraction
// (src/utils/storage.ts) because SecureStore enforces a 2 048-character per-value
// limit on iOS. Session metadata is not sensitive, so the absence of encryption is acceptable.
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'kronnus:active_session';

export interface PersistedSessionState {
  session_id: string;
  session_code: string;
  session_name: string;
  /** The device's checkpoint role ('' for coordinator until assigned) */
  role: string;
  /** NTP offset in milliseconds at last sync; 0 if not yet synced */
  offset_ms: number;
  /** Unix ms when session timing started; used to restore the live timer */
  session_start_ms: number;
  is_coordinator: boolean;
}

export async function saveSession(state: PersistedSessionState): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export async function loadSession(): Promise<PersistedSessionState | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSessionState;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
