import app from '../server.ts';

export default function handler(req: any, res: any) {
  const originalUrl = req.url || '';
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');

  if (path && !originalUrl.startsWith('/api/')) {
    req.url = `/api/${path}${originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : ''}`;
  }

  return app(req, res, (err?: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message || 'Server function failed' });
    }
    return res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
  });
}
