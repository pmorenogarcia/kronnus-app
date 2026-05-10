import type { Timestamp } from '@/src/api/timestamps';

export interface PendingCameraTimestamp {
  timestamp: Timestamp;
  capturedAtMs: number; // NTP-corrected absolute ms — timing screen subtracts sessionStartMs for display
}

let pending: PendingCameraTimestamp | null = null;

export function setPendingCameraTimestamp(value: PendingCameraTimestamp): void {
  pending = value;
}

// Returns and clears the pending value — safe to call on every focus.
export function takePendingCameraTimestamp(): PendingCameraTimestamp | null {
  const value = pending;
  pending = null;
  return value;
}
