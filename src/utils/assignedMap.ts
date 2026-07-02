import type { Timestamp } from '@/src/api/timestamps';

// Rebuilds the competitor -> elapsed-ms view from server-persisted timestamps.
// Used to recover assignments after a reconnect, since the live UI's assignedMap
// is otherwise pure in-memory state that resets on remount.
export function buildAssignedMap(
  timestamps: Timestamp[],
  sessionStartMs: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const ts of timestamps) {
    if (!ts.competitor_id) continue;
    map.set(ts.competitor_id, new Date(ts.corrected_at).getTime() - sessionStartMs);
  }
  return map;
}
