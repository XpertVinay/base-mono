import { DomainIntegrationEvent } from '../common/index.js';

export type UserRole = 'ADMIN' | 'USER' | 'AUDITOR';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export type UserRegisteredIntegrationEvent = DomainIntegrationEvent<UserRegisteredPayload>;
