import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const AUTH_TOKEN_KEY = 'auth_token';

export class RegistrationError extends Error {
  readonly statusCode: number;
  readonly field?: 'username' | 'email';

  constructor(message: string, statusCode: number, field?: 'username' | 'email') {
    super(message);
    this.name = 'RegistrationError';
    this.statusCode = statusCode;
    this.field = field;
  }
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<{ token: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
  } catch {
    throw new RegistrationError(
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
          : 'An account with those details already exists.';
    throw new RegistrationError(message, 409, field);
  }

  if (!response.ok) {
    throw new RegistrationError('Something went wrong. Please try again.', response.status);
  }

  const data = (await response.json()) as { token: string };
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
  return { token: data.token };
}
