import type { CheckpointRole } from '@/src/api';

// All WebSocket message types exchanged with kronnus-api.
// Must stay in sync with the backend protocol.

type Envelope<T extends string, P extends object = Record<string, never>> = {
  type: T;
  payload: P;
};

export type DeviceConnectedMsg = Envelope<
  'DEVICE_CONNECTED',
  { device_id: string; user_email?: string; role: CheckpointRole }
>;

export type DeviceDisconnectedMsg = Envelope<'DEVICE_DISCONNECTED', { device_id: string }>;

export type SyncReadyMsg = Envelope<'SYNC_READY'>;

export type SyncPingMsg = Envelope<'SYNC_PING', { client_ts: number }>;

export type SyncPongMsg = Envelope<'SYNC_PONG', { client_ts: number; server_ts: number }>;

export type SyncCompleteMsg = Envelope<'SYNC_COMPLETE', { offset_ms: number }>;

export type RoleAssignedMsg = Envelope<'ROLE_ASSIGNED', { role: CheckpointRole }>;

export type SessionStartMsg = Envelope<'SESSION_START'>;

export type SessionEndMsg = Envelope<'SESSION_END'>;

export type SessionStartRejectedMsg = Envelope<'SESSION_START_REJECTED', { reason: string }>;

export type WsMessage =
  | DeviceConnectedMsg
  | DeviceDisconnectedMsg
  | SyncReadyMsg
  | SyncPingMsg
  | SyncPongMsg
  | SyncCompleteMsg
  | RoleAssignedMsg
  | SessionStartMsg
  | SessionEndMsg
  | SessionStartRejectedMsg;
