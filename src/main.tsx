import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { SESSION_TOKEN_KEY, USER_STORAGE_KEY, LEGACY_USER_KEY } from './lib/constants.ts';

const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url.includes('/api/')) {
    const headers = new Headers(init?.headers || {});
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('X-User-Email')) {
      try {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem(LEGACY_USER_KEY);
        const email = storedUser ? String(JSON.parse(storedUser)?.email || '').trim().toLowerCase() : '';
        if (email) headers.set('X-User-Email', email);
      } catch {
        /* ignore stale local user */
      }
    }
    return nativeFetch(input, { ...init, headers, credentials: init?.credentials ?? 'include' });
  }
  return nativeFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
