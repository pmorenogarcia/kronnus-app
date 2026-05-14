import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveQueue, loadQueue, clearQueue } from '@/src/utils/queuePersistence';
import type { QueuedCapture } from '@/src/utils/queuePersistence';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const sessionId = 'sess-xyz';
const captures: QueuedCapture[] = [
  { capturedAtMs: 1_700_000_001_000, displayMs: 5000, triggerType: 'BUTTON' },
  { capturedAtMs: 1_700_000_002_000, displayMs: 6000, triggerType: 'CAMERA' },
];

beforeEach(() => AsyncStorage.clear());

test('saveQueue and loadQueue round-trip', async () => {
  await saveQueue(sessionId, captures);
  const loaded = await loadQueue(sessionId);
  expect(loaded).toEqual(captures);
});

test('loadQueue returns empty array when nothing stored', async () => {
  const loaded = await loadQueue(sessionId);
  expect(loaded).toEqual([]);
});

test('clearQueue removes the queue', async () => {
  await saveQueue(sessionId, captures);
  await clearQueue(sessionId);
  const loaded = await loadQueue(sessionId);
  expect(loaded).toEqual([]);
});

test('queues are keyed by sessionId — different sessions are independent', async () => {
  await saveQueue('sess-a', [captures[0]]);
  await saveQueue('sess-b', [captures[1]]);
  expect(await loadQueue('sess-a')).toEqual([captures[0]]);
  expect(await loadQueue('sess-b')).toEqual([captures[1]]);
});
