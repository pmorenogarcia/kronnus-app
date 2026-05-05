export { RegistrationError, registerUser } from './auth';
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
export { listSessions, deleteSession } from './sessions';
export { captureTimestamp, assignCompetitor, listTimestamps, TimestampError } from './timestamps';
export type { Timestamp } from './timestamps';
export { getResults } from './results';
export type { SegmentTime, CompetitorResult, ResultsResponse } from './results';
