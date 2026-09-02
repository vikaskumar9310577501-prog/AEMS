const LAST_ROUTE_KEY = 'ams_last_route_v1';

const EXCLUDED_PATHS = new Set(['/login', '/']);

function isPersistablePath(pathname: string): boolean {
  if (!pathname || EXCLUDED_PATHS.has(pathname)) return false;
  return !pathname.startsWith('/login');
}

/** Remember the last in-app route (refresh helpers / diagnostics). */
export function saveLastRoute(pathname: string, search = ''): void {
  if (!isPersistablePath(pathname)) return;
  try {
    sessionStorage.setItem(LAST_ROUTE_KEY, `${pathname}${search}`);
  } catch {
    /* ignore */
  }
}

export function readLastRoute(): string | null {
  try {
    const saved = sessionStorage.getItem(LAST_ROUTE_KEY);
    if (!saved) return null;
    const pathname = saved.split('?')[0];
    if (!isPersistablePath(pathname)) return null;
    return saved;
  } catch {
    return null;
  }
}

import { isHrRole } from './userPermissions';

/** After login always land on authorized dashboard */
export function resolvePostAuthRoute(_from?: string | null, role?: string | null): string {
  if (isHrRole(role)) return '/hr-dashboard';
  return '/dashboard';
}

