import { LoginRequest, LoginResponse } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export async function callHello(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/hello`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.text();
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }
  return response.json() as Promise<LoginResponse>;
}
