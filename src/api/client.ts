import { User } from '@/types';
import { deleteItem, getItem, setItem } from '@/src/utils/storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const AUTH_TOKEN_KEY = 'auth_token';

// ─── Error classes ───────────────────────────────────────────────────────────

export class AuthError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export class SessionError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'SessionError';
    this.statusCode = statusCode;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type SportType = 'CYCLING' | 'ATHLETICS' | 'TRAIL_RUNNING' | 'SKI' | 'SNOWBOARD';
export type SessionStatus = 'DRAFT' | 'WAITING' | 'ACTIVE' | 'FINISHED';
export type CheckpointRole = 'START' | 'SPLIT' | 'END';

export interface JoinSessionResponse {
  id: string;
  session_id: string;
  user_id: string;
  role: CheckpointRole;
  joined_at: string;
}

export interface CreateSessionInput {
  name: string;
  sport: SportType;
  session_date: string; // RFC3339
}

export interface Session {
  id: string;
  name: string;
  sport: SportType;
  status: SessionStatus;
  session_code: string;
  session_date: string;
  created_at: string;
  created_by?: string;
  competitor_count?: number;
  checkpoint_count?: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginUser(identifier: string, password: string): Promise<{ token: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
  } catch {
    throw new AuthError('Could not connect to the server. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new AuthError(
      response.status === 400 || response.status === 401
        ? 'Invalid email/username or password.'
        : 'Something went wrong. Please try again.',
      response.status,
    );
  }

  const data = (await response.json()) as { token: string };
  await setItem(AUTH_TOKEN_KEY, data.token);
  return { token: data.token };
}

export async function getMe(token: string): Promise<User> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AuthError('Could not connect to the server. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new AuthError('Failed to fetch user profile.', response.status);
  }

  const data = (await response.json()) as { id: string; email: string; username?: string };
  return { id: data.id, email: data.email, username: data.username };
}

export async function getStoredToken(): Promise<string | null> {
  return getItem(AUTH_TOKEN_KEY);
}

export async function clearStoredToken(): Promise<void> {
  await deleteItem(AUTH_TOKEN_KEY);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(token: string, input: CreateSessionInput): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }

  if (response.status !== 201) {
    throw new SessionError(
      response.status === 400
        ? 'Invalid session data. Please check your inputs.'
        : 'Failed to create session.',
      response.status,
    );
  }

  return (await response.json()) as Session;
}

export async function openSession(token: string, sessionId: string): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/open`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new SessionError('Failed to open session.', response.status);
  }

  return (await response.json()) as Session;
}

export async function listSessions(token: string): Promise<Session[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new SessionError('Failed to load sessions.', response.status);
  }
  return (await response.json()) as Session[];
}

export async function startSession(token: string, sessionId: string): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new SessionError('Failed to start session.', response.status);
  }
  return (await response.json()) as Session;
}

export async function joinSession(
  token: string,
  code: string,
  role: CheckpointRole,
): Promise<JoinSessionResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, role }),
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }

  if (response.status === 404) {
    throw new SessionError('Session not found. Check the code and try again.', 404);
  }
  if (response.status === 409) {
    throw new SessionError('already_joined', 409);
  }
  if (response.status === 422) {
    throw new SessionError('This session is not accepting new operators yet.', 422);
  }
  if (!response.ok) {
    throw new SessionError('Failed to join session.', response.status);
  }

  return (await response.json()) as JoinSessionResponse;
}

export interface SessionCheckpointState {
  user_id: string;
  username: string;
  role: string;
  synced: boolean;
}

export interface Competitor {
  id: string;
  session_id: string;
  display_name: string;
  bib_number: string;
  created_at: string;
}

export interface SessionStateResponse {
  session: Session;
  checkpoints: SessionCheckpointState[];
}

export async function setCheckpointRole(
  token: string,
  sessionCode: string,
  userId: string,
  role: CheckpointRole,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/sessions/${sessionCode}/checkpoints/${userId}/role`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      },
    );
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new SessionError('Failed to assign role.', response.status);
  }
}

export async function addCompetitor(
  token: string,
  sessionCode: string,
  displayName: string,
  bibNumber?: string,
): Promise<Competitor> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionCode}/competitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ display_name: displayName, bib_number: bibNumber ?? '' }),
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new SessionError('Failed to add competitor.', response.status);
  }
  return (await response.json()) as Competitor;
}

export async function listCompetitors(token: string, sessionCode: string): Promise<Competitor[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionCode}/competitors`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new SessionError('Failed to fetch competitors.', response.status);
  }
  return (await response.json()) as Competitor[];
}

export async function getSessionState(
  token: string,
  sessionCode: string,
): Promise<SessionStateResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionCode}/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new SessionError('Failed to fetch session state.', response.status);
  }
  return (await response.json()) as SessionStateResponse;
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (response.status === 409) {
    throw new SessionError('Cannot delete a session that is in progress', 409);
  }
  if (response.status !== 204) {
    throw new SessionError('Failed to delete session.', response.status);
  }
}
