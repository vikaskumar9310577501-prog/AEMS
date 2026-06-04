/** Parse fetch body as JSON; surface HTML/error pages clearly (e.g. wrong dev port). */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(res.ok ? 'Empty response from server' : `Request failed (${res.status})`);
  }
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    throw new Error(
      'Server returned a web page instead of JSON. Run the app with npm run dev and open http://localhost:3000 (not Vite port 5173 alone).'
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed || `Invalid JSON (${res.status})`
    );
  }
}
