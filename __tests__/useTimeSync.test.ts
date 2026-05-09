/**
 * @jest-environment node
 *
 * Pure math functions have no React/Expo dependency — run in the node
 * environment to avoid jest-expo's native-module bootstrap overhead.
 */

import { calculateOffsetNs, calculateRttNs, median } from '../src/hooks/useTimeSync';

// All timestamps in nanoseconds, matching the backend protocol.
// Derivation helpers used to construct test fixtures:
//   t2 = t1 + offset_ns + d_up_ns   (server receives: server clock = client + offset, plus uplink)
//   t3 = t2                          (server sends instantly in all fixtures below)
//   t4 = t3 - offset_ns + d_down_ns  (client receives: convert server time back to client time)

describe('calculateRttNs', () => {
  it('calculates RTT from known timestamps', () => {
    // offset=50ms, d_up=100ms, d_down=100ms → total RTT=200ms
    const t1 = 1_000_000_000;
    const t2 = 1_150_000_000;
    const t3 = 1_150_000_000;
    const t4 = 1_200_000_000;

    expect(calculateRttNs(t1, t2, t3, t4)).toBe(200_000_000);
  });

  it('excludes server processing time from RTT', () => {
    // offset=50ms, d_up=100ms, d_down=100ms, server processing=50ms → network RTT still 200ms
    const t1 = 1_000_000_000;
    const t2 = 1_150_000_000; // t1 + 50ms offset + 100ms up
    const t3 = 1_200_000_000; // t2 + 50ms server processing
    const t4 = 1_250_000_000; // t3 - 50ms offset + 100ms down

    expect(calculateRttNs(t1, t2, t3, t4)).toBe(200_000_000); // network-only RTT
  });
});

describe('calculateOffsetNs', () => {
  it('calculates correct offset from known timestamps', () => {
    // Server is 50ms ahead of client; symmetric 100ms delays
    const t1 = 1_000_000_000;
    const t2 = 1_150_000_000; // t1 + 50ms offset + 100ms up
    const t3 = 1_150_000_000;
    const t4 = 1_200_000_000; // t3 - 50ms offset + 100ms down

    expect(calculateOffsetNs(t1, t2, t3, t4)).toBe(50_000_000);
  });

  it('returns 0 offset for symmetric delays with synchronized clocks', () => {
    // Clocks aligned, equal up/down delays — the formula must recover zero offset
    const t1 = 1_000_000_000;
    const t2 = 1_100_000_000; // no offset, 100ms up
    const t3 = 1_100_000_000;
    const t4 = 1_200_000_000; // no offset, 100ms down

    expect(calculateOffsetNs(t1, t2, t3, t4)).toBe(0);
  });

  it('reflects asymmetric delay as apparent offset when clocks are synchronized', () => {
    // No clock offset, but d_up=150ms > d_down=50ms.
    // The NTP formula cannot distinguish network asymmetry from a real clock difference;
    // it reports an apparent offset of (d_up - d_down) / 2 = 50ms.
    // This is a fundamental NTP limitation documented in the precision comment of useTimeSync.ts.
    const t1 = 1_000_000_000;
    const t2 = 1_150_000_000; // no offset, 150ms up
    const t3 = 1_150_000_000;
    const t4 = 1_200_000_000; // no offset, 50ms down

    expect(calculateOffsetNs(t1, t2, t3, t4)).toBe(50_000_000);
  });
});

describe('median', () => {
  it('returns the middle value of an odd-length array', () => {
    // Sorted: [9, 10, 11, 12, 100] → middle index 2 → 11
    expect(median([10, 12, 11, 9, 100])).toBe(11);
  });

  it('returns the average of the two middle values for an even-length array', () => {
    // Sorted: [10, 20, 30, 40] → (20 + 30) / 2 = 25
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('does not let an outlier dominate — proving the median selection is outlier-resistant', () => {
    // Five rounds; one bad round at 100ms, four stable rounds ~10ms.
    // Median must be 11_000_000 ns, not the arithmetic mean (~28.4ms).
    const offsets = [10_000_000, 12_000_000, 11_000_000, 9_000_000, 100_000_000];

    expect(median(offsets)).toBe(11_000_000);
  });

  it('handles a single-element array', () => {
    expect(median([42_000_000])).toBe(42_000_000);
  });
});
