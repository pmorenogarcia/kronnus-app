export {
  AuthError,
  loginUser,
  getMe,
  getStoredToken,
  clearStoredToken,
  SessionError,
  createSession,
  openSession,
  listMySessions,
  startSession,
  joinSession,
  getSessionState,
  setCheckpointRole,
  addCompetitor,
  listCompetitors,
} from './client';
export type {
  SportType,
  SessionStatus,
  CheckpointRole,
  CreateSessionInput,
  Session,
  JoinSessionResponse,
  SessionCheckpointState,
  SessionStateResponse,
  Competitor,
} from './client';
export { captureTimestamp, assignCompetitor, listTimestamps, TimestampError } from './timestamps';
export type { Timestamp } from './timestamps';
