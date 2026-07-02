import { buildAssignedMap } from '@/src/utils/assignedMap';
import type { Timestamp } from '@/src/api/timestamps';

const sessionStartMs = 1_700_000_000_000;

function makeTimestamp(overrides: Partial<Timestamp>): Timestamp {
  return {
    id: 'ts-1',
    session_id: 'sess-1',
    checkpoint_id: 'cp-1',
    checkpoint_role: 'SPLIT',
    captured_at: new Date(sessionStartMs).toISOString(),
    corrected_at: new Date(sessionStartMs).toISOString(),
    sequence_number: 1,
    competitor_id: null,
    trigger_type: 'BUTTON',
    created_at: new Date(sessionStartMs).toISOString(),
    ...overrides,
  };
}

test('maps assigned timestamps to elapsed ms since session start', () => {
  const timestamps: Timestamp[] = [
    makeTimestamp({
      id: 'ts-1',
      competitor_id: 'comp-a',
      corrected_at: new Date(sessionStartMs + 5_000).toISOString(),
    }),
    makeTimestamp({
      id: 'ts-2',
      competitor_id: 'comp-b',
      corrected_at: new Date(sessionStartMs + 12_340).toISOString(),
    }),
  ];

  const result = buildAssignedMap(timestamps, sessionStartMs);

  expect(result.get('comp-a')).toBe(5_000);
  expect(result.get('comp-b')).toBe(12_340);
  expect(result.size).toBe(2);
});

test('skips timestamps that have no competitor assigned', () => {
  const timestamps: Timestamp[] = [
    makeTimestamp({ id: 'ts-1', competitor_id: null }),
    makeTimestamp({
      id: 'ts-2',
      competitor_id: 'comp-b',
      corrected_at: new Date(sessionStartMs + 1_000).toISOString(),
    }),
  ];

  const result = buildAssignedMap(timestamps, sessionStartMs);

  expect(result.size).toBe(1);
  expect(result.get('comp-b')).toBe(1_000);
});

test('returns an empty map for an empty input list', () => {
  const result = buildAssignedMap([], sessionStartMs);
  expect(result.size).toBe(0);
});
