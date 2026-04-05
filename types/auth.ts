export interface User {
  id: number;
  name: string;
  initials: string;
  email: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
