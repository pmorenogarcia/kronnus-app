// useSessionSocket imports @react-native-firebase/auth transitively (via
// src/lib/auth's getToken) — stub it so this test file doesn't need the
// native module, same as auth-context.test.tsx.
import { connectWithFreshToken } from '../src/hooks/useSessionSocket';
import { computeBackoffMs } from '../src/ws/backoff';

jest.mock('@react-native-firebase/auth', () => () => ({ currentUser: null }));

// ─── connectWithFreshToken — every (re)connect attempt fetches its own token ──

describe('connectWithFreshToken', () => {
  it('connects using the token returned by getToken', async () => {
    const connect = jest.fn();
    const onNoToken = jest.fn();
    const getToken = jest.fn().mockResolvedValue('fresh-token');

    await connectWithFreshToken('session-1', connect, onNoToken, getToken);

    expect(connect).toHaveBeenCalledWith('session-1', 'fresh-token');
    expect(onNoToken).not.toHaveBeenCalled();
  });

  it('calls onNoToken and does not connect when signed out', async () => {
    const connect = jest.fn();
    const onNoToken = jest.fn();
    const getToken = jest.fn().mockResolvedValue(null);

    await connectWithFreshToken('session-1', connect, onNoToken, getToken);

    expect(connect).not.toHaveBeenCalled();
    expect(onNoToken).toHaveBeenCalled();
  });

  it('fetches a new token on every call instead of reusing a previous one', async () => {
    const connect = jest.fn();
    const onNoToken = jest.fn();
    const getToken = jest.fn().mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');

    await connectWithFreshToken('session-1', connect, onNoToken, getToken);
    await connectWithFreshToken('session-1', connect, onNoToken, getToken);

    expect(connect).toHaveBeenNthCalledWith(1, 'session-1', 'token-1');
    expect(connect).toHaveBeenNthCalledWith(2, 'session-1', 'token-2');
    expect(getToken).toHaveBeenCalledTimes(2);
  });
});

// ─── Pure backoff function ────────────────────────────────────────────────────

describe('computeBackoffMs', () => {
  it('starts at 1 second', () => {
    expect(computeBackoffMs(0)).toBe(1_000);
  });

  it('doubles on each attempt', () => {
    expect(computeBackoffMs(1)).toBe(2_000);
    expect(computeBackoffMs(2)).toBe(4_000);
    expect(computeBackoffMs(3)).toBe(8_000);
    expect(computeBackoffMs(4)).toBe(16_000);
  });

  it('caps at 30 seconds', () => {
    expect(computeBackoffMs(5)).toBe(30_000);
    expect(computeBackoffMs(100)).toBe(30_000);
  });

  it('never returns below 1 second', () => {
    for (let i = 0; i < 20; i++) {
      expect(computeBackoffMs(i)).toBeGreaterThanOrEqual(1_000);
    }
  });
});

// ─── Reconnect loop timing with mock WebSocket ────────────────────────────────

const MAX_ATTEMPTS = 6;

describe('reconnection backoff timing (mock WebSocket)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires reconnects at the correct cumulative elapsed time', () => {
    const firedAt: number[] = [];
    let attempt = 0;

    // Simulates the reconnect loop that lives in useSessionSocket
    const schedule = () => {
      if (attempt >= MAX_ATTEMPTS) return;
      const delay = computeBackoffMs(attempt++);
      setTimeout(() => {
        firedAt.push(Date.now());
        schedule();
      }, delay);
    };

    schedule(); // start the reconnect chain
    jest.runAllTimers();

    // Cumulative elapsed: 1s | +2s | +4s | +8s | +16s | +30s
    expect(firedAt).toEqual([1_000, 3_000, 7_000, 15_000, 31_000, 61_000]);
  });

  it('fires exactly MAX_ATTEMPTS reconnects then stops', () => {
    const connectCalls: number[] = [];
    let attempt = 0;

    const schedule = () => {
      if (attempt >= MAX_ATTEMPTS) return;
      const delay = computeBackoffMs(attempt);
      attempt++;
      setTimeout(() => {
        connectCalls.push(attempt);
        schedule();
      }, delay);
    };

    schedule();
    jest.runAllTimers();

    expect(connectCalls).toHaveLength(MAX_ATTEMPTS);
  });

  it('produces the correct delay sequence for each attempt', () => {
    const delays: number[] = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      delays.push(computeBackoffMs(i));
    }
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000]);
  });
});
