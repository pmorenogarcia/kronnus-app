// NOTE: AsyncStorage is used instead of the project's expo-secure-store abstraction
// (src/utils/storage.ts) because SecureStore enforces a 2 048-character per-value
// limit on iOS. A queue of serialised captures can exceed this limit. Session metadata
// is not sensitive, so the absence of encryption is acceptable here.
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_PREFIX = 'kronnus:queue:';

// Canonical definition — imported by timing.tsx to eliminate duplicate type risk.
export interface QueuedCapture {
  capturedAtMs: number; // raw Date.now() — sent to the API; server applies NTP offset
  displayMs: number; // NTP-corrected — shown in the modal
  triggerType: 'BUTTON' | 'CAMERA';
}

export async function saveQueue(sessionId: string, items: QueuedCapture[]): Promise<void> {
  await AsyncStorage.setItem(`${QUEUE_PREFIX}${sessionId}`, JSON.stringify(items));
}

export async function loadQueue(sessionId: string): Promise<QueuedCapture[]> {
  const raw = await AsyncStorage.getItem(`${QUEUE_PREFIX}${sessionId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedCapture[];
  } catch {
    return [];
  }
}

export async function clearQueue(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(`${QUEUE_PREFIX}${sessionId}`);
}
