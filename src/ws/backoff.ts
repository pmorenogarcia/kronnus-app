const BASE_MS = 1_000;
const MAX_MS = 30_000;

export function computeBackoffMs(attempt: number): number {
  return Math.min(BASE_MS * 2 ** attempt, MAX_MS);
}
