// All WebSocket message types exchanged with kronnus-api.
// Must stay in sync with the backend protocol (internal/ws/message.go).

import type { CheckpointRole } from '@/src/api';

type Envelope<T extends string, P extends object = Record<string, never>> = {
  type: T;
  payload: P;
};

export type DeviceConnectedMsg = Envelope<
  'DEVICE_CONNECTED',
  { user_id: string; session_id: string; conn_id: string }
>;

export type DeviceDisconnectedMsg = Envelope<
  'DEVICE_DISCONNECTED',
  { user_id: string; session_id: string; conn_id: string }
>;

export type SyncReadyMsg = Envelope<'SYNC_READY'>;

// Client → server: t1 is the client timestamp at send time
export type SyncPingMsg = Envelope<'SYNC_PING', { t1: number }>;

// Server → client: t1 echoed, t2 = server receive, t3 = server send
export type SyncPongMsg = Envelope<'SYNC_PONG', { t1: number; t2: number; t3: number }>;

export type SyncCompleteMsg = Envelope<
  'SYNC_COMPLETE',
  { user_id: string; offset_ms: number; rtt_ms: number }
>;

export type RoleAssignMsg = Envelope<
  'ROLE_ASSIGN',
  { target_user_id: string; role: CheckpointRole }
>;

export type RoleAssignedMsg = Envelope<'ROLE_ASSIGNED', { user_id: string; role: CheckpointRole }>;

export type SessionStartMsg = Envelope<'SESSION_START', { session_id: string }>;

export type SessionEndMsg = Envelope<'SESSION_END', { session_id: string }>;

export type SessionStartRejectedMsg = Envelope<'SESSION_START_REJECTED', { reason: string }>;

// Server → client (individual, after SYNC_READY): provides persisted state for reconnect.
// Fields are nullable — do NOT overwrite a valid local value with null from the server.
export type SessionStateMsg = Envelope<
  'SESSION_STATE',
  {
    session_id: string;
    status: string;
    started_at_ms: number | null;
    role: CheckpointRole | null;
    offset_ms: number | null;
  }
>;

export type WsMessage =
  | DeviceConnectedMsg
  | DeviceDisconnectedMsg
  | SyncReadyMsg
  | SyncPingMsg
  | SyncPongMsg
  | SyncCompleteMsg
  | RoleAssignMsg
  | RoleAssignedMsg
  | SessionStartMsg
  | SessionEndMsg
  | SessionStartRejectedMsg
  | SessionStateMsg;
