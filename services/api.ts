const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

export async function callHello(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/hello`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.text();
}
