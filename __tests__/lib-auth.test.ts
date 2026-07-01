import { getToken } from '@/src/lib/auth';

interface FakeUser {
  getIdToken: jest.Mock;
}

const authState: { currentUser: FakeUser | null } = { currentUser: null };

jest.mock('@react-native-firebase/auth', () => () => authState);

beforeEach(() => {
  authState.currentUser = null;
});

describe('getToken', () => {
  it('returns null when no user is signed in', async () => {
    const result = await getToken();
    expect(result).toBeNull();
  });

  it('returns the current user ID token without forcing a refresh', async () => {
    const mockGetIdToken = jest.fn().mockResolvedValue('cached-or-fresh-token');
    authState.currentUser = { getIdToken: mockGetIdToken };

    const result = await getToken();

    expect(result).toBe('cached-or-fresh-token');
    expect(mockGetIdToken).toHaveBeenCalledWith(false);
  });
});
