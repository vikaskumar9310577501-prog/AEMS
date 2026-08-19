let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
  try {
    // Final Version Chal Gya
    appPromise ||= import('../server.js').then((mod) => mod.default);
    const app = await appPromise;

    return app(req, res, (err?: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ error: message || 'Server function failed' });
      }
      return res.status(404).json({
        error: `Route not found: ${req.method} ${req.url}`,
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      error: message || 'Server function failed during startup',
    });
  }
}
