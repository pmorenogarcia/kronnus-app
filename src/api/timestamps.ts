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
  token: string,
  body?: unknown,
): Promise<T> {
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
  token: string,
  sessionCode: string,
  capturedAtMs: number,
  triggerType: 'BUTTON' | 'CAMERA' = 'BUTTON',
): Promise<Timestamp> {
  return apiRequest<Timestamp>('POST', `/api/v1/sessions/${sessionCode}/timestamps`, token, {
    captured_at_ms: capturedAtMs,
    trigger_type: triggerType,
  });
}

export function assignCompetitor(
  token: string,
  sessionCode: string,
  timestampId: string,
  competitorId: string,
): Promise<Timestamp> {
  return apiRequest<Timestamp>(
    'PUT',
    `/api/v1/sessions/${sessionCode}/timestamps/${timestampId}/assign`,
    token,
    { competitor_id: competitorId },
  );
}

export function listTimestamps(token: string, sessionCode: string): Promise<Timestamp[]> {
  return apiRequest<Timestamp[]>('GET', `/api/v1/sessions/${sessionCode}/timestamps`, token);
}
