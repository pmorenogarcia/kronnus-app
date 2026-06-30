# Firebase Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom JWT auth system with Firebase Authentication SDK, keeping the same custom `User` type and API calls intact.

**Architecture:** `onIdTokenChanged` listener in `AuthProvider` replaces manual token storage. On each token event, we call `getMe()` with the Firebase ID Token to populate the app's custom `User` type from the backend (which already validates Firebase tokens). Screens call Firebase auth directly; the context reacts reactively.

**Tech Stack:** `@react-native-firebase/app`, `@react-native-firebase/auth`, Expo 55, React Native 0.83, TypeScript strict, jest-expo

## Global Constraints

- TypeScript strict mode — no `any`, no implicit types; cast unknown errors via `(err as { code?: string }).code`
- ESLint + Prettier enforced — run `npx expo lint` before each commit
- Functional components + hooks only
- `API_BASE_URL` from `src/api/client.ts` — never redefine elsewhere
- Design tokens in `constants/theme.ts` (`AppColors`) — screens use inline constants matching existing palette
- Barrel exports via `index.ts` — never import from deep paths
- The `feature/64-firebase-auth` branch must be created from `develop` before any changes

---

### Task 1: Branch + Firebase SDK + app.json + README (issue #65)

**Files:**

- Modify: `app.json` (add plugin)
- Modify: `README.md` (Expo Go deprecation)

**Interfaces:**

- Produces: `import auth from '@react-native-firebase/auth'` available in all subsequent tasks

- [ ] **Step 1: Create feature branch**

```bash
git checkout develop
git pull
git checkout -b feature/64-firebase-auth
```

- [ ] **Step 2: Install packages**

```bash
npm install @react-native-firebase/app @react-native-firebase/auth
```

Expected: both packages appear in `package.json` dependencies. No errors.

- [ ] **Step 3: Verify `google-services.json` is at root and gitignored**

```bash
ls google-services.json
grep google-services .gitignore
```

Expected: file exists, `.gitignore` contains `google-services.json`. No action needed — it's already set up.

- [ ] **Step 4: Add Firebase plugin to `app.json`**

In `app.json`, the `expo.plugins` array currently ends with `"expo-video"`. Add `"@react-native-firebase/app"` as the first plugin (Firebase must initialise before other plugins):

```json
"plugins": [
  "@react-native-firebase/app",
  "expo-router",
  [
    "expo-splash-screen",
    {
      "image": "./assets/images/splash-icon.png",
      "imageWidth": 200,
      "resizeMode": "contain",
      "backgroundColor": "#131313",
      "dark": {
        "backgroundColor": "#131313"
      }
    }
  ],
  "expo-camera",
  "expo-secure-store",
  "expo-font",
  "expo-image",
  "expo-web-browser",
  "expo-video"
]
```

- [ ] **Step 5: Add Expo Go deprecation note to README**

Open `README.md`. Find or create a "Development" section and add before any run instructions:

````markdown
## Development

> ⚠️ **Expo Go is no longer supported.** `@react-native-firebase` requires a native build.
> Use an EAS development client instead:
>
> ```bash
> eas build --profile development --platform android
> ```
>
> Install the resulting `.apk` on your device or emulator, then start Metro:
>
> ```bash
> npx expo start --dev-client
> ```
````

- [ ] **Step 6: Lint check**

```bash
npx expo lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add app.json README.md package.json package-lock.json
git commit -m "feat(#65): install @react-native-firebase, add plugin to app.json, update README"
```

---

### Task 2: Rewrite `contexts/auth-context.tsx` (issues #66 + epic auto-refresh)

**Files:**

- Modify: `contexts/auth-context.tsx`
- Create: `__tests__/auth-context.test.tsx`

> **Note:** This task adds `@testing-library/react-native` as a dev dependency. The project's existing tests only cover pure functions; this is the first hook test.

**Interfaces:**

- Consumes: `auth from '@react-native-firebase/auth'`, `getMe`, `AuthError` from `@/src/api`
- Produces:
  - `AuthProvider` — wraps app, listens to `onIdTokenChanged`
  - `useAuth()` → `{ token: string | null, user: User | null, isAuthenticated: boolean, isLoading: boolean, signOut: () => Promise<void>, updateUser: (u: User) => void }`
  - **`signIn(token)` is REMOVED** — screens no longer call it

- [ ] **Step 1: Install `@testing-library/react-native`**

```bash
npm install --save-dev @testing-library/react-native
```

Expected: package appears in `devDependencies`.

- [ ] **Step 2: Write the failing test**

Create `__tests__/auth-context.test.tsx`:

```typescript
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

// ── Firebase mock ─────────────────────────────────────────────────────────────
let capturedListener: ((user: unknown) => Promise<void>) | null = null;
const mockSignOut = jest.fn();

jest.mock('@react-native-firebase/auth', () => () => ({
  onIdTokenChanged: (cb: (user: unknown) => Promise<void>) => {
    capturedListener = cb;
    return () => { capturedListener = null; };
  },
  signOut: mockSignOut,
}));

// ── API mock ──────────────────────────────────────────────────────────────────
const mockGetMe = jest.fn();

jest.mock('@/src/api', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.name = 'AuthError';
      this.statusCode = code;
    }
  },
}));

import { AuthProvider, useAuth } from '@/contexts/auth-context';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedListener = null;
});

it('starts as loading with no token', () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.token).toBeNull();
  expect(result.current.user).toBeNull();
});

it('sets token and user when Firebase user is present', async () => {
  const fakeFirebaseUser = {
    getIdToken: jest.fn().mockResolvedValue('firebase-id-token'),
  };
  mockGetMe.mockResolvedValue({ id: 'u1', email: 'a@b.com', username: 'tester' });

  const { result } = renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await capturedListener!(fakeFirebaseUser);
  });

  expect(result.current.isLoading).toBe(false);
  expect(result.current.token).toBe('firebase-id-token');
  expect(result.current.user).toEqual({ id: 'u1', email: 'a@b.com', username: 'tester' });
  expect(result.current.isAuthenticated).toBe(true);
  expect(mockGetMe).toHaveBeenCalledWith('firebase-id-token');
});

it('clears token and user when Firebase user is null', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await capturedListener!(null);
  });

  expect(result.current.isLoading).toBe(false);
  expect(result.current.token).toBeNull();
  expect(result.current.user).toBeNull();
  expect(result.current.isAuthenticated).toBe(false);
});

it('signOut calls auth().signOut()', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });

  await act(async () => {
    await result.current.signOut();
  });

  expect(mockSignOut).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest __tests__/auth-context.test.tsx --no-coverage
```

Expected: FAIL — `useAuth must be used within AuthProvider` or import errors.

- [ ] **Step 4: Rewrite `contexts/auth-context.tsx`**

Replace the entire file with:

```typescript
import auth from '@react-native-firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { AuthError, getMe } from '@/src/api';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updateUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onIdTokenChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          const profile = await getMe(idToken);
          setUser(profile);
        } else {
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        if (err instanceof AuthError && (err.statusCode === 401 || err.statusCode === 403)) {
          await auth().signOut();
        }
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  async function signOut() {
    await auth().signOut();
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated: !!token, isLoading, signOut, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/auth-context.test.tsx --no-coverage
```

Expected: 4 passing tests.

- [ ] **Step 6: Lint check**

```bash
npx expo lint
```

Expected: 0 errors. (TypeScript will flag `signIn` usages in login.tsx and register.tsx — those are fixed in Tasks 4 and 5.)

- [ ] **Step 7: Commit**

```bash
git add contexts/auth-context.tsx __tests__/auth-context.test.tsx package.json package-lock.json
git commit -m "feat(#66): replace JWT auth with Firebase onIdTokenChanged in AuthProvider"
```

---

### Task 3: Clean up API layer — remove custom auth functions

**Files:**

- Modify: `src/api/client.ts`
- Modify: `src/api/auth.ts`
- Modify: `src/api/index.ts`

**Interfaces:**

- Consumes: nothing new
- Produces: `AuthError`, `getMe` still exported; `loginUser`, `getStoredToken`, `clearStoredToken`, `registerUser`, `RegistrationError` removed

- [ ] **Step 1: Remove `loginUser`, `getStoredToken`, `clearStoredToken` from `src/api/client.ts`**

The file currently imports `deleteItem, getItem, setItem` from `@/src/utils/storage` and defines `AUTH_TOKEN_KEY`. After removal those imports become unused. The `User` import from `@/types` is still needed for `getMe`.

Replace the top section of `src/api/client.ts` (lines 1–114) with:

```typescript
import { User } from '@/types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// ─── Error classes ───────────────────────────────────────────────────────────

export class AuthError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export class SessionError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'SessionError';
    this.statusCode = statusCode;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type SportType = 'CYCLING' | 'ATHLETICS' | 'TRAIL_RUNNING' | 'SKI' | 'SNOWBOARD';
export type SessionStatus = 'DRAFT' | 'WAITING' | 'ACTIVE' | 'FINISHED';
export type CheckpointRole = 'START' | 'SPLIT' | 'END';

export interface JoinSessionResponse {
  id: string;
  session_id: string;
  user_id: string;
  role: CheckpointRole;
  joined_at: string;
}

export interface CreateSessionInput {
  name: string;
  sport: SportType;
  session_date: string; // RFC3339
}

export interface Session {
  id: string;
  name: string;
  sport: SportType;
  status: SessionStatus;
  session_code: string;
  session_date: string;
  created_at: string;
  created_by?: string;
  competitor_count?: number;
  checkpoint_count?: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getMe(token: string): Promise<User> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AuthError('Could not connect to the server. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new AuthError('Failed to fetch user profile.', response.status);
  }

  const data = (await response.json()) as { id: string; email: string; username?: string };
  return { id: data.id, email: data.email, username: data.username };
}
```

The rest of the file (Sessions section onwards) stays unchanged.

- [ ] **Step 2: Remove `registerUser` and `RegistrationError` from `src/api/auth.ts`**

Replace the entire file with:

```typescript
import type { User } from '@/types';

import { API_BASE_URL } from './client';

export class UpdateProfileError extends Error {
  readonly statusCode: number;
  readonly field?: 'username' | 'email';

  constructor(message: string, statusCode: number, field?: 'username' | 'email') {
    super(message);
    this.name = 'UpdateProfileError';
    this.statusCode = statusCode;
    this.field = field;
  }
}

export async function updateMe(
  token: string,
  updates: { username?: string; email?: string },
): Promise<User> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
  } catch {
    throw new UpdateProfileError(
      'Could not connect to the server. Check your connection and try again.',
      0,
    );
  }

  if (response.status === 409) {
    let field: 'username' | 'email' | undefined;
    try {
      const body = (await response.json()) as { field?: string };
      if (body.field === 'username' || body.field === 'email') field = body.field;
    } catch {
      // ignore parse errors
    }
    const message =
      field === 'username'
        ? 'Username already taken.'
        : field === 'email'
          ? 'Email already in use.'
          : 'Those details are already in use.';
    throw new UpdateProfileError(message, 409, field);
  }

  if (!response.ok) {
    throw new UpdateProfileError('Failed to update profile. Please try again.', response.status);
  }

  const data = (await response.json()) as { id: string; email: string; username?: string };
  return { id: data.id, email: data.email, username: data.username };
}
```

- [ ] **Step 3: Update `src/api/index.ts` barrel exports**

Replace the entire file with:

```typescript
export { UpdateProfileError, updateMe } from './auth';
export {
  API_BASE_URL,
  AuthError,
  getMe,
  SessionError,
  createSession,
  openSession,
  listSessions,
  startSession,
  joinSession,
  getSessionState,
  setCheckpointRole,
  addCompetitor,
  listCompetitors,
  deleteSession,
} from './client';
export type {
  SportType,
  SessionStatus,
  CheckpointRole,
  CreateSessionInput,
  Session,
  JoinSessionResponse,
  SessionCheckpointState,
  SessionStateResponse,
  Competitor,
} from './client';
export { captureTimestamp, assignCompetitor, listTimestamps, TimestampError } from './timestamps';
export type { Timestamp } from './timestamps';
export { getResults } from './results';
export type { SegmentTime, CompetitorResult, ResultsResponse } from './results';
```

- [ ] **Step 4: Lint check — expect errors only in login.tsx and register.tsx**

```bash
npx expo lint
```

Expected: errors in `app/login.tsx` (uses removed `loginUser`) and `app/register.tsx` (uses removed `registerUser`, `RegistrationError`). Zero errors in other files. These are fixed in the next two tasks.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/auth.ts src/api/index.ts
git commit -m "refactor(#65): remove loginUser, registerUser, getStoredToken from API layer"
```

---

### Task 4: Update `app/login.tsx` (issue #67)

**Files:**

- Modify: `app/login.tsx`

**Interfaces:**

- Consumes: `auth from '@react-native-firebase/auth'`, `router from 'expo-router'`
- Produces: Login screen that calls `signInWithEmailAndPassword(email, password)` with no backend auth call

- [ ] **Step 1: Replace the login screen logic**

The entire import block and `LoginScreen` function body change. The JSX (UI layout) stays **identical** — only imports and the `handleSignIn` function body change.

Replace the imports at the top of `app/login.tsx`:

```typescript
import auth from '@react-native-firebase/auth';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

Remove these imports (no longer needed):

- `import { useAuth } from '@/contexts';`
- `import { loginUser } from '@/src/api';`

Replace the state declarations inside `LoginScreen`:

```typescript
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
```

Replace `handleSignIn`:

```typescript
async function handleSignIn() {
  if (!email.trim() || !password.trim()) {
    setError('Please enter your email and password.');
    return;
  }

  setError(null);
  setLoading(true);
  try {
    await auth().signInWithEmailAndPassword(email.trim(), password);
    router.replace('/(tabs)');
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        setError('Invalid email or password.');
        break;
      case 'auth/too-many-requests':
        setError('Too many attempts. Try again later.');
        break;
      case 'auth/network-request-failed':
        setError('No connection. Check your network.');
        break;
      default:
        setError('Login failed. Please try again.');
    }
  } finally {
    setLoading(false);
  }
}
```

In the JSX, update the email field — rename state refs from `identifier` to `email` and update the label and input:

```tsx
<Text style={styles.label}>EMAIL</Text>
<View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
  <Feather name="mail" size={18} color={C.textSecondary} style={styles.inputIcon} />
  <TextInput
    style={styles.input}
    placeholder="joao.duarte@email.com"
    placeholderTextColor={C.textMuted}
    value={email}
    onChangeText={setEmail}
    onFocus={() => setEmailFocused(true)}
    onBlur={() => setEmailFocused(false)}
    autoCapitalize="none"
    keyboardType="email-address"
    autoCorrect={false}
    returnKeyType="next"
  />
</View>
```

Update password field to use `passwordFocused` (rename from `passwordFocused` which was already the name — just keep consistent).

- [ ] **Step 2: Lint check**

```bash
npx expo lint
```

Expected: 0 errors in `login.tsx`. Only `register.tsx` may still have errors.

- [ ] **Step 3: Commit**

```bash
git add app/login.tsx
git commit -m "feat(#67): replace loginUser with signInWithEmailAndPassword on login screen"
```

---

### Task 5: Update `app/register.tsx` (issue #68)

**Files:**

- Modify: `app/register.tsx`

**Interfaces:**

- Consumes: `auth from '@react-native-firebase/auth'`
- Produces: Register screen that calls `createUserWithEmailAndPassword` + `updateProfile` with no backend call

- [ ] **Step 1: Replace the register screen imports and logic**

Replace the imports at the top of `app/register.tsx`:

```typescript
import auth from '@react-native-firebase/auth';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

Remove these imports (no longer needed):

- `import { useAuth } from '@/contexts';`
- `import { RegistrationError, registerUser } from '@/src/api';`

Remove `const { signIn } = useAuth();` from the component body.

Replace `handleRegister`:

```typescript
async function handleRegister() {
  setGlobalError(null);
  if (!validate()) return;

  setLoading(true);
  try {
    const credential = await auth().createUserWithEmailAndPassword(email.trim(), password);
    await credential.user.updateProfile({ displayName: username.trim() });
    router.replace('/(tabs)');
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    switch (code) {
      case 'auth/email-already-in-use':
        setFieldError('email', 'An account with this email already exists.');
        break;
      case 'auth/weak-password':
        setFieldError('password', 'Password must be at least 6 characters.');
        break;
      case 'auth/invalid-email':
        setFieldError('email', 'Please enter a valid email address.');
        break;
      default:
        setGlobalError('Registration failed. Please try again.');
    }
  } finally {
    setLoading(false);
  }
}
```

The `validate()` function, all field state, and all JSX remain unchanged. Only `handleRegister` and imports change.

- [ ] **Step 2: Lint check**

```bash
npx expo lint
```

Expected: 0 errors, 0 warnings across the entire project.

- [ ] **Step 3: Commit**

```bash
git add app/register.tsx
git commit -m "feat(#68): replace registerUser with createUserWithEmailAndPassword on register screen"
```

---

### Task 6: Update route guard + run full test suite (epic self + final check)

**Files:**

- Modify: `app/_layout.tsx`

**Interfaces:**

- Consumes: `useAuth()` — `isAuthenticated`, `isLoading`
- Produces: Route guard that redirects from both `login` and `register` screens when authenticated

- [ ] **Step 1: Update the route guard in `app/_layout.tsx`**

Inside `RootNavigator`, replace the `useEffect` body:

```typescript
useEffect(() => {
  if (isLoading) return;
  const inTabsGroup = firstSegment === '(tabs)';
  const inAuthScreen = firstSegment === 'login' || firstSegment === 'register';

  if (!isAuthenticated && inTabsGroup) {
    router.replace('/login');
  } else if (isAuthenticated && inAuthScreen) {
    router.replace('/(tabs)');
  }
}, [isAuthenticated, isLoading, firstSegment]);
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass plus the 4 new auth-context tests.

- [ ] **Step 3: Final lint check**

```bash
npx expo lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(#64): update route guard to cover register screen + complete Firebase auth migration"
```

---

## Post-Implementation

After merging to `develop`, the next step is a device build:

```bash
eas build --profile development --platform android
```

This is a manual step outside this plan — it requires EAS credentials and a physical device or emulator.
