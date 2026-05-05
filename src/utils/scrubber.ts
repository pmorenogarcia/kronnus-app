/**
 * Pure utilities for the camera scrubber fallback.
 *
 * Frame-rate-limited detection has a ~33–67ms uncertainty window (one poll
 * interval at 15 fps). The scrubber lets an operator capture a still frame and
 * manually shift the recorded timestamp within ±500ms to compensate. This
 * approach trades automation for precision under adverse lighting conditions.
 */

export function applyManualOffset(baseMs: number, offsetMs: number): number {
  return baseMs + offsetMs;
}

export function formatOffsetLabel(offsetMs: number): string {
  if (offsetMs === 0) return '0ms';
  if (offsetMs > 0) return `+${offsetMs}ms`;
  return `${offsetMs}ms`;
}
