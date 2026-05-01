import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/contexts';
import type { CheckpointRole } from '@/src/api';
import { computeBackoffMs } from '@/src/ws/backoff';
import type { WsMessage } from '@/src/ws/messages';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const MAX_ATTEMPTS = 6;

function toWsUrl(sessionId: string, token: string): string {
  const base = API_BASE_URL.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');
  return `${base}/api/v1/sessions/${sessionId}/ws?token=${encodeURIComponent(token)}`;
}

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseSessionSocketReturn {
  status: SocketStatus;
  lastMessage: WsMessage | null;
  error: string | null;
  sessionStarted: boolean;
  syncReadyReceived: boolean;
  assignedRole: CheckpointRole | null;
  send: (type: string, payload: object) => void;
  disconnect: () => void;
}

export function useSessionSocket(sessionId: string | null): UseSessionSocketReturn {
  const { token } = useAuth();

  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [syncReadyReceived, setSyncReadyReceived] = useState(false);
  const [assignedRole, setAssignedRole] = useState<CheckpointRole | null>(null);

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
      // Updated on every ROLE_ASSIGNED — coordinator may reassign before session starts
      if (msg.type === 'ROLE_ASSIGNED') setAssignedRole(msg.payload.role);

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
      timerRef.current = setTimeout(() => connectRef.current(id, jwt), delay);
    };

    ws.onerror = () => {
      if (__DEV__) console.log('[WS] error');
      // onerror is always followed by onclose; reconnect logic lives there
    };
  };

  useEffect(() => {
    if (!sessionId || !token) return;

    stoppedRef.current = false;
    attemptRef.current = 0;
    connectRef.current(sessionId, token);

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
  }, [sessionId, token]);

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
    assignedRole,
    send,
    disconnect,
  };
}
