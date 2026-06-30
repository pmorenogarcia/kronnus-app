# Firebase Auth Migration — Design Spec

**Epic:** #64 — Migrate authentication to Firebase Auth
**Tasks:** #65 #66 #67 #68
**Branch:** `feature/64-firebase-auth`
**Date:** 2026-06-30

---

## Context

Replace the custom JWT auth system (POST /api/v1/auth/login) with Firebase Authentication.
The backend (`kronnus-api`) already validates Firebase ID Tokens via `internal/firebase/verifier.go`
and auto-provisions user profiles on first API call (`UsernameFromEmail(email, uid)` in middleware).

## Architecture

### Auth state flow (new)

```
App start
  └─ onIdTokenChanged (Firebase listener)
       ├─ firebaseUser present → getIdToken() → getMe(token) → setToken + setUser
       └─ no user → setToken(null) + setUser(null)
       └─ setIsLoading(false) on first call

Login
  └─ signInWithEmailAndPassword(email, password)
       └─ onIdTokenChanged fires → context updates → route guard navigates to /(tabs)

Register
  └─ createUserWithEmailAndPassword(email, password)
       └─ updateProfile({ displayName: username })
       └─ onIdTokenChanged fires → context updates → route guard navigates to /(tabs)

Sign out
  └─ auth().signOut() → onIdTokenChanged fires (null) → context clears
```

### User type

Keep the custom `User` type `{ id: string; email: string; username?: string }` unchanged.
`getMe()` is called with the Firebase token to get the app's user from the backend.
No changes needed to `profile.tsx` or `edit-profile.tsx`.

### Token storage

Firebase SDK handles persistence internally. Token lives in React state (in-memory).
No SecureStore/AsyncStorage caching of the token needed.

## Files Changed

### `contexts/auth-context.tsx`

- Replace `getStoredToken` + `getMe` polling with `onIdTokenChanged` listener
- `onIdTokenChanged` → `getIdToken()` → `getMe(token)` → set state
- Remove `signIn(token)` from public interface
- `signOut()` → `auth().signOut()`
- `isLoading` resolves on first `onIdTokenChanged` callback

### `app/login.tsx`

- Field: "EMAIL OR USERNAME" → "EMAIL" (Firebase email-only)
- Replace `loginUser()` + `signIn(token)` with `auth().signInWithEmailAndPassword(email, password)`
- Map Firebase error codes: `auth/invalid-credential`, `auth/too-many-requests`, `auth/network-request-failed`
- `router.replace('/(tabs)')` after success

### `app/register.tsx`

- Replace `registerUser()` + `signIn(token)` with `createUserWithEmailAndPassword()` + `updateProfile({ displayName: username })`
- Map Firebase error codes: `auth/email-already-in-use`, `auth/weak-password`, `auth/invalid-email`
- `router.replace('/(tabs)')` after success

### `app/_layout.tsx`

- Route guard: also redirect from `register` screen when `isAuthenticated`

### `src/api/client.ts`

- Remove: `loginUser()`, `getStoredToken()`, `clearStoredToken()`

### `src/api/auth.ts`

- Remove: `registerUser()`, `RegistrationError`
- Keep: `updateMe()`, `UpdateProfileError`

### `src/api/index.ts`

- Remove deleted exports

### `app.json`

- Add `@react-native-firebase/app` to plugins array

### `README.md`

- Add ⚠️ Expo Go deprecation note

## Out of Scope

- EAS build execution (code-only change; EAS build is a separate manual step)
- Social sign-in (Google, Apple)
- Backend changes (already done)
- Edit-profile screen (already works via updateMe + Firebase token)

## Acceptance Criteria

- [ ] Login works via Firebase — no call to `/api/v1/auth/login`
- [ ] Registration works via Firebase — no call to any custom register endpoint
- [ ] Token passed to API is a Firebase ID Token
- [ ] Token auto-refreshes without user action (via onIdTokenChanged)
- [ ] `npx expo lint` passes, TypeScript strict mode clean
