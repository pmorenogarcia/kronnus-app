function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatElapsedMs(ms: number): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${String(millis).padStart(3, '0')}`;
}

export function formatGap(ms: number): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60_000);
  const s = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  return `+${pad2(m)}:${pad2(s)}.${String(millis).padStart(3, '0')}`;
}
