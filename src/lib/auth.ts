import auth from '@react-native-firebase/auth';

// Firebase ID Tokens expire after 1 hour, but a timing session can run
// 2–4 hours. Every API call must go through this instead of caching a token
// from context/state — getIdToken(false) returns the cached token unless it's
// within 5 minutes of expiry, in which case it silently refreshes first.
export async function getToken(): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;
  return user.getIdToken(false);
}
