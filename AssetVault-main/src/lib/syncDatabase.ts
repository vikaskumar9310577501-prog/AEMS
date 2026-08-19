import { isItAdminRole } from './userPermissions';

/** Pull latest assets from Google Sheets. Sheet rebuild is best-effort for IT Admin. */
export async function syncDatabaseAssets(opts: {
  userEmail?: string;
  userRole?: string | null;
  fetchAssets: (opts?: { force?: boolean; silent?: boolean }) => Promise<void>;
}): Promise<void> {
  const base = import.meta.env.VITE_API_BASE_URL || '';

  const syncRes = await fetch(`${base}/api/assets/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userEmail: opts.userEmail || '' }),
  });

  if (syncRes.ok) {
    await opts.fetchAssets({ force: true, silent: true });
    return;
  }

  if (syncRes.status !== 404) {
    const syncData = await syncRes.json().catch(() => ({}));
    throw new Error((syncData as { error?: string }).error || `Sync failed (${syncRes.status})`);
  }

  // Older server without /api/assets/sync — rebuild optional, then force refresh
  if (opts.userEmail && isItAdminRole(opts.userRole)) {
    try {
      await fetch(`${base}/api/assets/rebuild-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userEmail: opts.userEmail }),
      });
    } catch {
      /* rebuild optional */
    }
  }

  await opts.fetchAssets({ force: true, silent: true });
}
