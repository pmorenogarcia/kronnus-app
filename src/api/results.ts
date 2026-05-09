import { API_BASE_URL } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentTime {
  from_role: string;
  to_role: string;
  elapsed_ms: number;
}

export interface CompetitorResult {
  competitor_id: string;
  display_name: string;
  bib_number: string;
  total_ms: number;
  dnf: boolean;
  segments: SegmentTime[];
}

export interface ResultsResponse {
  results: CompetitorResult[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getResults(token: string, sessionCode: string): Promise<ResultsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionCode}/results`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ResultsResponse>;
}
