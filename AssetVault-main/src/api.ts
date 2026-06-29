export type ApiResponse<T> = { ok: boolean; data?: T; error?: string };

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function apiRequest<T>(path: string, options: RequestInit = {}, auth: boolean = true): Promise<ApiResponse<T>> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (auth) {
    const token = localStorage.getItem('sessionToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || res.statusText };
  return { ok: true, data };
}

// Auth
export const requestOtp = (email: string) => apiRequest<{ message: string }>('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) }, false);
export const verifyOtp = (email: string, otp: string) => apiRequest<{ user: any; token: string }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }, false);
export const validateSession = () => apiRequest<any>('/auth/session');
export const logoutSession = () => apiRequest<void>('/auth/logout', { method: 'POST' });

// Users
export const fetchUsers = () => apiRequest<any[]>('/users');
export const createUser = (user: any) => apiRequest<any>('/users', { method: 'POST', body: JSON.stringify(user) });
export const updateUser = (email: string, user: any) => apiRequest<any>(`/users/${encodeURIComponent(email)}`, { method: 'PUT', body: JSON.stringify(user) });
export const deleteUser = (email: string) => apiRequest<any>(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' });

// Settings
export const fetchSettings = () => apiRequest<any>('/settings');
export const saveSettings = (settings: any) => apiRequest<any>('/settings', { method: 'POST', body: JSON.stringify(settings) });

// Assets (existing functions can be kept in their own modules)
export const fetchAssets = () => apiRequest<any[]>('/assets');
export const createAsset = (asset: any) => apiRequest<any>('/assets', { method: 'POST', body: JSON.stringify(asset) });
export const updateAsset = (id: number, asset: any) => apiRequest<any>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(asset) });
export const deleteAsset = (id: number) => apiRequest<any>(`/assets/${id}`, { method: 'DELETE' });
