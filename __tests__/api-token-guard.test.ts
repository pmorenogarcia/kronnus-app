// Every src/api/* function must source its token from getToken() rather than
// accepting it as a parameter, so callers can never pass a stale one. This
// covers one representative function per module — the guard is identical
// (2-line "no token -> throw" check) everywhere else in each module.

import { getMe, AuthError } from '@/src/api/client';
import { updateMe, UpdateProfileError } from '@/src/api/auth';
import { listTimestamps, TimestampError } from '@/src/api/timestamps';
import { getResults } from '@/src/api/results';

const mockGetToken = jest.fn();
jest.mock('@/src/lib/auth', () => ({ getToken: (...args: unknown[]) => mockGetToken(...args) }));

const mockFetch = jest.fn();

(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getMe', () => {
  it('throws AuthError without calling fetch when signed out', async () => {
    mockGetToken.mockResolvedValue(null);
    await expect(getMe()).rejects.toThrow(AuthError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends the token from getToken() as the Bearer header', async () => {
    mockGetToken.mockResolvedValue('fresh-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', email: 'a@b.com', username: 'x' }),
    });

    await getMe();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer fresh-token' } }),
    );
  });
});

describe('updateMe', () => {
  it('throws UpdateProfileError without calling fetch when signed out', async () => {
    mockGetToken.mockResolvedValue(null);
    await expect(updateMe({ username: 'x' })).rejects.toThrow(UpdateProfileError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('listTimestamps', () => {
  it('throws TimestampError without calling fetch when signed out', async () => {
    mockGetToken.mockResolvedValue(null);
    await expect(listTimestamps('CODE1')).rejects.toThrow(TimestampError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('getResults', () => {
  it('throws without calling fetch when signed out', async () => {
    mockGetToken.mockResolvedValue(null);
    await expect(getResults('CODE1')).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
