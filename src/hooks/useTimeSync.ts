/*
 * JavaScript's Date.now() has millisecond precision on most platforms.
 * React Native may offer sub-millisecond resolution via performance.now()
 * on some devices. The NTP formula is mathematically correct but the
 * practical floor of this implementation is ~1ms, not the theoretical
 * sub-millisecond of hardware NTP. This is documented as a known constraint
 * of the platform.
 *
 * Timestamps are sent and received in nanoseconds to match the backend
 * protocol (Go int64 ns). Date.now() * 1_000_000 converts ms → ns. Because
 * JavaScript's Number type has 53-bit mantissa, epoch-based ns values
 * (~1.7×10¹⁸) lose ~256ns of resolution to floating-point rounding — well
 * below the 1ms floor imposed by Date.now(), so it does not add meaningful
 * error.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { UseSessionSocketReturn } from './useSessionSocket';

const N_ROUNDS = 5;
const PONG_TIMEOUT_MS = 5_000;
const ROUND_DELAY_MS = 200;

// ─── Pure calculation functions (exported for unit testing) ──────────────────

/** RTT in nanoseconds: network round-trip time excluding server processing. */
export function calculateRttNs(t1: number, t2: number, t3: number, t4: number): number {
  return t4 - t1 - (t3 - t2);
}

/**
 * Clock offset in nanoseconds: how far ahead the server clock is relative to
 * the client clock. Add this to a client timestamp to get a server-aligned time.
 */
export function calculateOffsetNs(t1: number, t2: number, t3: number, t4: number): number {
  return (t2 - t1 + (t3 - t4)) / 2;
}

/** Returns the median of a numeric array. Non-destructive. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseTimeSyncReturn {
  synced: boolean;
  offsetMs: number | null;
  rttMs: number | null;
  syncInProgress: boolean;
  getCorrectedTimestamp: () => number;
}

// userId is sent for protocol completeness; the backend authenticates from the
// WebSocket connection and overrides this field with the authoritative value.
export function useTimeSync(socket: UseSessionSocketReturn, userId: string): UseTimeSyncReturn {
  const { lastMessage, send } = socket;

  const [synced, setSynced] = useState(false);
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [syncInProgress, setSyncInProgress] = useState(false);

  const roundResultsRef = useRef<{ offsetNs: number; rttNs: number }[]>([]);
  const currentT1Ref = useRef<number>(0);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncActiveRef = useRef(false);

  // Updated every render so the setTimeout callback always calls the latest
  // version without a stale reference to `send`.
  const doRoundRef = useRef<() => void>(() => {});
  doRoundRef.current = () => {
    const t1 = Date.now() * 1_000_000;
    currentT1Ref.current = t1;

    if (pongTimeoutRef.current !== null) clearTimeout(pongTimeoutRef.current);
    pongTimeoutRef.current = setTimeout(() => {
      if (syncActiveRef.current) doRoundRef.current();
    }, PONG_TIMEOUT_MS);

    send('SYNC_PING', { t1 });
  };

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'SYNC_READY') {
      syncActiveRef.current = true;
      roundResultsRef.current = [];
      if (pongTimeoutRef.current !== null) clearTimeout(pongTimeoutRef.current);
      if (delayTimerRef.current !== null) clearTimeout(delayTimerRef.current);
      setSyncInProgress(true);
      setSynced(false);
      doRoundRef.current();
      return;
    }

    if (lastMessage.type !== 'SYNC_PONG' || !syncActiveRef.current) return;

    const { t1, t2, t3 } = lastMessage.payload;

    // Discard stale pongs from a previous retry round
    if (t1 !== currentT1Ref.current) return;

    const t4 = Date.now() * 1_000_000;

    if (pongTimeoutRef.current !== null) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }

    roundResultsRef.current.push({
      rttNs: calculateRttNs(t1, t2, t3, t4),
      offsetNs: calculateOffsetNs(t1, t2, t3, t4),
    });

    if (roundResultsRef.current.length >= N_ROUNDS) {
      const medianOffsetNs = median(roundResultsRef.current.map((r) => r.offsetNs));
      const medianRttNs = median(roundResultsRef.current.map((r) => r.rttNs));
      // Round to integer ms — backend SyncCompletePayload.OffsetMs is Go int;
      // json.Unmarshal rejects floats for int fields and silently drops the message.
      const finalOffsetMs = Math.round(medianOffsetNs / 1_000_000);
      const finalRttMs = medianRttNs / 1_000_000; // float64 on backend, no rounding needed

      send('SYNC_COMPLETE', {
        user_id: userId,
        offset_ms: finalOffsetMs,
        rtt_ms: finalRttMs,
      });

      syncActiveRef.current = false;
      setSynced(true);
      setOffsetMs(finalOffsetMs);
      setRttMs(finalRttMs);
      setSyncInProgress(false);
    } else {
      delayTimerRef.current = setTimeout(() => {
        if (syncActiveRef.current) doRoundRef.current();
      }, ROUND_DELAY_MS);
    }
  }, [lastMessage, send, userId]);

  useEffect(() => {
    return () => {
      syncActiveRef.current = false;
      if (pongTimeoutRef.current !== null) clearTimeout(pongTimeoutRef.current);
      if (delayTimerRef.current !== null) clearTimeout(delayTimerRef.current);
    };
  }, []);

  const getCorrectedTimestamp = useCallback((): number => {
    return Date.now() + (offsetMs ?? 0);
  }, [offsetMs]);

  return { synced, offsetMs, rttMs, syncInProgress, getCorrectedTimestamp };
}
