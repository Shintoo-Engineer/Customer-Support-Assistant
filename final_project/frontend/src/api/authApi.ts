import api from './client';
import type { LoginResponse, AuthUser, UsersListResponse } from '../types';

export const authApi = {
  /**
   * Authenticate user with email and password against backend database.
   */
  login: (email: string, password: string) => {
    return api.post<LoginResponse>('/auth/login', { email, password });
  },

  /**
   * Register a new customer user.
   */
  register: (name: string, email: string, password: string) => {
    return api.post<{ message: string; user_id: number; name: string; email: string; role: string }>('/auth/register', { name, email, password });
  },

  /**
   * Validate token and fetch current user profile and role from backend.
   */
  getMe: () => {
    return api.get<AuthUser>('/auth/me');
  },

  /**
   * Fetch all registered users (Admin only).
   */
  getUsers: () => {
    return api.get<UsersListResponse>('/users/');
  },

  /**
   * Create a new user (Admin only - POST /users/).
   */
  createUser: (data: { name: string; email: string; password: string; role: 'admin' | 'employee' }) => {
    return api.post<{ message: string; user_id: number; name: string; email: string; role: string }>('/users/', data);
  },
};

export default authApi;
