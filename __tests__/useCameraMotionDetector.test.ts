/**
 * @jest-environment node
 *
 * Pure calculation functions have no React/Expo dependency — run in the node
 * environment to avoid jest-expo's native-module bootstrap overhead.
 */

import { computeAverageLuminance, isMotionDetected } from '../src/hooks/useCameraMotionDetector';

describe('computeAverageLuminance', () => {
  it('returns 0 for empty data', () => {
    expect(computeAverageLuminance(new Uint8Array([]))).toBe(0);
  });

  it('returns 255 for all-white data', () => {
    const data = new Uint8Array(16).fill(255);
    expect(computeAverageLuminance(data)).toBe(255);
  });

  it('returns 0 for all-black data', () => {
    const data = new Uint8Array(16).fill(0);
    expect(computeAverageLuminance(data)).toBe(0);
  });

  it('samples every 4th byte — non-sampled bytes do not affect the result', () => {
    // Sampled indices: 0, 4 → values 200, 200; bytes at 1,2,3,5,6,7 are 0
    const data = new Uint8Array([200, 0, 0, 0, 200, 0, 0, 0]);
    expect(computeAverageLuminance(data)).toBe(200);
  });

  it('averages the sampled byte values', () => {
    // Sampled indices: 0 and 4 → values 100 and 200 → avg = 150
    const data = new Uint8Array([100, 0, 0, 0, 200, 0, 0, 0]);
    expect(computeAverageLuminance(data)).toBe(150);
  });

  it('handles a single-byte array (only index 0 is sampled)', () => {
    const data = new Uint8Array([128]);
    expect(computeAverageLuminance(data)).toBe(128);
  });
});

describe('isMotionDetected', () => {
  it('returns true when luminance drops below baseline × threshold', () => {
    // low sensitivity (0.85): trigger if current < 85
    expect(isMotionDetected(80, 100, 0.85)).toBe(true);
  });

  it('returns false when luminance is above the detection boundary', () => {
    // low sensitivity (0.85): 90 is above 85 → no trigger
    expect(isMotionDetected(90, 100, 0.85)).toBe(false);
  });

  it('returns false when luminance equals exactly baseline × threshold (strict less-than)', () => {
    // boundary value 85 must not trigger
    expect(isMotionDetected(85, 100, 0.85)).toBe(false);
  });

  it('uses medium sensitivity threshold (0.78) correctly', () => {
    expect(isMotionDetected(75, 100, 0.78)).toBe(true);
    expect(isMotionDetected(80, 100, 0.78)).toBe(false);
  });

  it('uses high sensitivity threshold (0.70) correctly', () => {
    expect(isMotionDetected(65, 100, 0.7)).toBe(true);
    expect(isMotionDetected(72, 100, 0.7)).toBe(false);
  });

  it('does not trigger when baseline is zero (avoids division-by-zero edge case)', () => {
    // 0 < 0 * any_threshold → 0 < 0 → false, no false positive
    expect(isMotionDetected(0, 0, 0.85)).toBe(false);
  });
});
