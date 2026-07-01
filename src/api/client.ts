import { getToken } from '@/src/lib/auth';
import { User } from '@/types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

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

export async function getMe(): Promise<User> {
  const token = await getToken();
  if (!token) throw new AuthError('Not signed in.', 401);

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

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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

export async function openSession(sessionId: string): Promise<Session> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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

export async function listSessions(): Promise<Session[]> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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

export async function startSession(sessionId: string): Promise<Session> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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
  code: string,
  role: CheckpointRole,
): Promise<JoinSessionResponse> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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
  sessionCode: string,
  userId: string,
  role: CheckpointRole,
): Promise<void> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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
  sessionCode: string,
  displayName: string,
  bibNumber?: string,
): Promise<Competitor> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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

export async function listCompetitors(sessionCode: string): Promise<Competitor[]> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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

export async function getSessionState(sessionCode: string): Promise<SessionStateResponse> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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

export async function deleteSession(sessionId: string): Promise<void> {
  const token = await getToken();
  if (!token) throw new SessionError('Not signed in.', 401);

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
