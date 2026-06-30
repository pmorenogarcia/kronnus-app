export { UpdateProfileError, updateMe } from './auth';
export {
  API_BASE_URL,
  AuthError,
  getMe,
  SessionError,
  createSession,
  openSession,
  listSessions,
  startSession,
  joinSession,
  getSessionState,
  setCheckpointRole,
  addCompetitor,
  listCompetitors,
  deleteSession,
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
export { getResults } from './results';
export type { SegmentTime, CompetitorResult, ResultsResponse } from './results';
