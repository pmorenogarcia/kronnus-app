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

interface DeviceConnectedPayload {
  user_id: string;
  session_id: string;
  conn_id: string;
}

interface DeviceDisconnectedPayload {
  user_id: string;
  session_id: string;
  conn_id: string;
}

interface RoleAssignedPayload {
  user_id: string;
  role: string;
}

interface WsMessage {
  type: string;
  payload?: unknown;
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

      if (msg.type === 'DEVICE_CONNECTED') {
        const p = msg.payload as DeviceConnectedPayload;
        setRemoteDevices((prev) => {
          if (prev.some((d) => d.id === p.user_id)) return prev;
          return [...prev, { id: p.user_id, name: p.user_id, role: 'SPLIT' }];
        });
      } else if (msg.type === 'DEVICE_DISCONNECTED') {
        const p = msg.payload as DeviceDisconnectedPayload;
        setRemoteDevices((prev) => prev.filter((d) => d.id !== p.user_id));
      } else if (msg.type === 'ROLE_ASSIGNED') {
        const p = msg.payload as RoleAssignedPayload;
        setRemoteDevices((prev) =>
          prev.map((d) => (d.id === p.user_id ? { ...d, role: p.role as CheckpointRole } : d)),
        );
      } else if (msg.type === 'SESSION_START') {
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
