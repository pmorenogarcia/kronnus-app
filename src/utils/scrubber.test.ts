/**
 * @jest-environment node
 *
 * Pure scrubber utility functions — no React/Expo dependencies.
 */

import { applyManualOffset, formatOffsetLabel } from './scrubber';

describe('applyManualOffset', () => {
  it('adds a positive offset to the base timestamp', () => {
    expect(applyManualOffset(1_000_000, 120)).toBe(1_000_120);
  });

  it('subtracts when offset is negative', () => {
    expect(applyManualOffset(1_000_000, -120)).toBe(999_880);
  });

  it('returns the base timestamp unchanged when offset is zero', () => {
    expect(applyManualOffset(1_000_000, 0)).toBe(1_000_000);
  });
});

describe('formatOffsetLabel', () => {
  it('prefixes a positive offset with "+"', () => {
    expect(formatOffsetLabel(120)).toBe('+120ms');
  });

  it('formats a negative offset without doubling the minus sign', () => {
    expect(formatOffsetLabel(-50)).toBe('-50ms');
  });

  it('formats zero as "0ms" without a sign prefix', () => {
    expect(formatOffsetLabel(0)).toBe('0ms');
  });
});
