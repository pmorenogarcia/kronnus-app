import { useEffect, useRef, useState } from 'react';

import type { CheckpointRole } from '@/src/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

function toWsUrl(sessionId: string, token: string): string {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/api/v1/sessions/${sessionId}/ws?token=${encodeURIComponent(token)}`;
}

export interface RemoteDevice {
  id: string;
  name: string;
  role: CheckpointRole;
}

// Assumed WS message types — align with ../kronnus-api when protocol is finalised
interface WsMessage {
  type: string;
  payload?: unknown;
}

interface DeviceJoinedPayload {
  device_id: string;
  user_email?: string;
  role: CheckpointRole;
}

interface DeviceLeftPayload {
  device_id: string;
}

interface UseSessionWebSocketOptions {
  sessionId: string;
  token: string;
  enabled?: boolean;
}

interface UseSessionWebSocketReturn {
  remoteDevices: RemoteDevice[];
  isConnected: boolean;
  sessionStarted: boolean;
}

export function useSessionWebSocket({
  sessionId,
  token,
  enabled = true,
}: UseSessionWebSocketOptions): UseSessionWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [remoteDevices, setRemoteDevices] = useState<RemoteDevice[]>([]);

  useEffect(() => {
    if (!enabled || !sessionId || !token) return;

    const url = toWsUrl(sessionId, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(event.data as string) as WsMessage;
      } catch {
        return;
      }

      if (msg.type === 'device_joined') {
        const p = msg.payload as DeviceJoinedPayload;
        setRemoteDevices((prev) => {
          if (prev.some((d) => d.id === p.device_id)) return prev;
          return [...prev, { id: p.device_id, name: p.user_email ?? p.device_id, role: p.role }];
        });
      } else if (msg.type === 'device_left') {
        const p = msg.payload as DeviceLeftPayload;
        setRemoteDevices((prev) => prev.filter((d) => d.id !== p.device_id));
      } else if (msg.type === 'session_started') {
        setSessionStarted(true);
      }
    };

    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    return () => {
      ws.close();
    };
  }, [sessionId, token, enabled]);

  return { remoteDevices, isConnected, sessionStarted };
}
