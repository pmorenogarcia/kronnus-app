import { useCallback, useEffect, useRef, useState } from 'react';

import { getToken } from '@/src/lib/auth';
import { API_BASE_URL } from '@/src/api/client';
import { computeBackoffMs } from '@/src/ws/backoff';
import type { WsMessage } from '@/src/ws/messages';
// 120 attempts × 30 s cap ≈ 60 minutes — enough for mountain sports dead zones.
const MAX_ATTEMPTS = 120;

function toWsUrl(sessionId: string, token: string): string {
  const base = API_BASE_URL.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');
  return `${base}/api/v1/sessions/${sessionId}/ws?token=${encodeURIComponent(token)}`;
}

// WS token-refresh decision (issue #69): the backend validates the Firebase
// ID token only once, during the HTTP upgrade handshake (see UpgradeCheck in
// kronnus-api/internal/handler/ws_handler.go) — it never re-verifies the
// token per message. So a healthy, already-open connection does NOT need to
// be torn down just because the underlying ID token refreshes in the
// background during a long timing session (2–4h, longer than the 1h token
// lifetime). What DOES matter: every connection attempt — the initial one
// and every automatic reconnect after a drop — must present a token that is
// valid *at that moment*, since a drop can happen at any point in a long
// session, potentially after the original token has expired. That's why
// reconnects call getToken() fresh instead of reusing the token the
// connection was first opened with.
export async function connectWithFreshToken(
  sessionId: string,
  connect: (id: string, token: string) => void,
  onNoToken: () => void,
  fetchToken: () => Promise<string | null> = getToken,
): Promise<void> {
  const token = await fetchToken();
  if (!token) {
    onNoToken();
    return;
  }
  connect(sessionId, token);
}

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseSessionSocketReturn {
  status: SocketStatus;
  lastMessage: WsMessage | null;
  error: string | null;
  sessionStarted: boolean;
  syncReadyReceived: boolean;
  send: (type: string, payload: object) => void;
  disconnect: () => void;
}

export function useSessionSocket(sessionId: string | null): UseSessionSocketReturn {
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [syncReadyReceived, setSyncReadyReceived] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);

  // Updated every render so setTimeout callbacks always see the latest version
  // without stale closure issues — avoids listing volatile refs in useCallback deps.
  const connectRef = useRef<(id: string, jwt: string) => void>(() => {});

  connectRef.current = (id: string, jwt: string): void => {
    if (stoppedRef.current) return;

    setStatus('connecting');

    const url = toWsUrl(id, jwt);

    if (__DEV__) {
      console.log(`[WS] connecting (attempt ${attemptRef.current}):`, url);
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Guard against stale callbacks from a replaced connection
      if (wsRef.current !== ws) return;
      if (__DEV__) console.log('[WS] connected');
      attemptRef.current = 0;
      setStatus('connected');
      setError(null);
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      let msg: WsMessage;
      try {
        msg = JSON.parse(event.data as string) as WsMessage;
      } catch {
        return;
      }
      if (__DEV__) console.log('[WS] ←', msg.type);
      setLastMessage(msg);

      // Latch once — never resets so batching cannot cause the flag to be missed
      if (msg.type === 'SESSION_START') setSessionStarted(true);
      // One-way latch: survives React 18 batching (see useTimeSync.ts for race details)
      if (msg.type === 'SYNC_READY') setSyncReadyReceived(true);

      // Server signalled session is over — stop reconnecting
      if (msg.type === 'SESSION_END') {
        stoppedRef.current = true;
        ws.close();
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (__DEV__) console.log('[WS] closed');

      if (stoppedRef.current) {
        setStatus('disconnected');
        return;
      }

      if (attemptRef.current >= MAX_ATTEMPTS) {
        setStatus('error');
        setError('Connection lost. Please check your network.');
        return;
      }

      const delay = computeBackoffMs(attemptRef.current);
      attemptRef.current += 1;

      if (__DEV__) console.log(`[WS] reconnecting in ${delay}ms`);
      timerRef.current = setTimeout(() => {
        void connectWithFreshToken(id, connectRef.current, () => {
          setStatus('error');
          setError('Session expired. Please sign in again.');
        });
      }, delay);
    };

    ws.onerror = () => {
      if (__DEV__) console.log('[WS] error');
      // onerror is always followed by onclose; reconnect logic lives there
    };
  };

  useEffect(() => {
    if (!sessionId) return;

    stoppedRef.current = false;
    attemptRef.current = 0;
    void connectWithFreshToken(sessionId, connectRef.current, () => {
      setStatus('error');
      setError('Not signed in.');
    });

    return () => {
      stoppedRef.current = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Null wsRef before closing so the stale-guard in onclose exits early
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [sessionId]);

  const send = useCallback((type: string, payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const disconnect = useCallback(() => {
    stoppedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    ws?.close();
    setStatus('disconnected');
  }, []);

  return {
    status,
    lastMessage,
    error,
    sessionStarted,
    syncReadyReceived,
    send,
    disconnect,
  };
}
