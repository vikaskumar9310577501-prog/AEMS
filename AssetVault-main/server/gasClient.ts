/** Build GAS Web App GET URL with optional action params. */
export function gasGetUrl(baseUrl: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params);
  const qs = query.toString();
  if (!qs) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}${qs}`;
}

export function parseGasResponseText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty response from Google Apps Script");
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error("Database returned HTML instead of JSON — redeploy WebApp.gs");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Invalid JSON from Database: ${trimmed.slice(0, 120)}`);
  }
}

export function gasResponseError(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const r = parsed as Record<string, unknown>;
  if (r.error) return String(r.error);
  if (r.success === false) return String(r.message || r.error || "Request failed");
  return null;
}

/** POST to GAS Web App (JSON body). */
export async function gasPost(
  gasUrl: string,
  payload: Record<string, unknown>,
  timeoutMs = 45000
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const parsed = parseGasResponseText(await response.text());
    const err = gasResponseError(parsed);
    if (err) throw new Error(err);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/** GET from GAS Web App with query params. */
export async function gasGet(
  gasUrl: string,
  params: Record<string, string> = {},
  timeoutMs = 45000
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = gasGetUrl(gasUrl, params);
    const response = await fetch(url, { signal: controller.signal });
    const parsed = parseGasResponseText(await response.text());
    const err = gasResponseError(parsed);
    if (err) throw new Error(err);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
