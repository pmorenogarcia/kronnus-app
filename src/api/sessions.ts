import type { Session } from './client';
import { SessionError } from './client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export async function listSessions(token: string): Promise<Session[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new SessionError('Could not connect to the server. Check your connection and try again.');
  }
  if (!response.ok) throw new SessionError('Failed to load sessions.', response.status);
  return response.json() as Promise<Session[]>;
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
