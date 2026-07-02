import { getToken } from '@/src/lib/auth';

import { API_BASE_URL } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Timestamp {
  id: string;
  session_id: string;
  checkpoint_id: string;
  checkpoint_role: 'START' | 'SPLIT' | 'END';
  captured_at: string;
  corrected_at: string;
  sequence_number: number;
  competitor_id: string | null;
  trigger_type: 'BUTTON' | 'CAMERA';
  created_at: string;
}

export class TimestampError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'TimestampError';
    this.statusCode = statusCode;
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new TimestampError('Not signed in.', 401);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // ignore parse failure
    }
    throw new TimestampError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function captureTimestamp(
  sessionCode: string,
  capturedAtMs: number,
  triggerType: 'BUTTON' | 'CAMERA' = 'BUTTON',
): Promise<Timestamp> {
  return apiRequest<Timestamp>('POST', `/api/v1/sessions/${sessionCode}/timestamps`, {
    captured_at_ms: capturedAtMs,
    trigger_type: triggerType,
  });
}

export function assignCompetitor(
  sessionCode: string,
  timestampId: string,
  competitorId: string,
): Promise<Timestamp> {
  return apiRequest<Timestamp>(
    'PUT',
    `/api/v1/sessions/${sessionCode}/timestamps/${timestampId}/assign`,
    { competitor_id: competitorId },
  );
}

export function listTimestamps(sessionCode: string): Promise<Timestamp[]> {
  return apiRequest<Timestamp[]>('GET', `/api/v1/sessions/${sessionCode}/timestamps`);
}

export function listMyTimestamps(sessionCode: string): Promise<Timestamp[]> {
  return apiRequest<Timestamp[]>('GET', `/api/v1/sessions/${sessionCode}/timestamps/mine`);
}
