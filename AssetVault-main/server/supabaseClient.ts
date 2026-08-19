import { getSupabaseSecret, getSupabaseUrl } from "./sqlConfig.js";

export const FILES_BUCKET = "aems-files";
export const DATA_BUCKET = "aems-data";

function headers(extra: Record<string, string> = {}) {
  const key = getSupabaseSecret();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${getSupabaseUrl()}${path}`;
  return fetch(url, {
    ...init,
    headers: { ...headers(init.headers as Record<string, string>), ...(init.headers || {}) },
  });
}

export async function sbJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await sbFetch(path, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase ${response.status} ${path}`);
  }
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

async function createBucket(id: string, isPublic: boolean, fileSizeLimit: number): Promise<void> {
  const existing = await sbFetch("/storage/v1/bucket");
  const buckets = existing.ok ? ((await existing.json()) as Array<{ id: string }>) : [];
  if (buckets.some((b) => b.id === id)) return;
  const created = await sbFetch("/storage/v1/bucket", {
    method: "POST",
    body: JSON.stringify({ id, name: id, public: isPublic, fileSizeLimit }),
  });
  if (!created.ok) {
    const text = await created.text();
    if (!/already exists|duplicate/i.test(text)) {
      throw new Error(`Storage bucket ${id} failed: ${text}`);
    }
  }
}

export async function ensureStorageBucket(): Promise<void> {
  await createBucket(FILES_BUCKET, true, 15728640);
  await createBucket(DATA_BUCKET, false, 52428800);
}

export function publicFileUrl(objectPath: string): string {
  return `${getSupabaseUrl()}/storage/v1/object/public/${FILES_BUCKET}/${objectPath}`;
}

export async function uploadToStorage(
  objectPath: string,
  bytes: Buffer,
  mimeType: string,
  bucket = FILES_BUCKET
): Promise<string> {
  await ensureStorageBucket();
  const response = await fetch(`${getSupabaseUrl()}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: getSupabaseSecret(),
      Authorization: `Bearer ${getSupabaseSecret()}`,
      "Content-Type": mimeType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    throw new Error(`File upload failed: ${await response.text()}`);
  }
  if (bucket === FILES_BUCKET) return publicFileUrl(objectPath);
  return `${bucket}/${objectPath}`;
}

export async function downloadFromStorage(
  objectPath: string,
  bucket = FILES_BUCKET
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const response = await fetch(`${getSupabaseUrl()}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: {
      apikey: getSupabaseSecret(),
      Authorization: `Bearer ${getSupabaseSecret()}`,
    },
  });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, contentType: response.headers.get("content-type") || "application/octet-stream" };
}

export { FILES_BUCKET as BUCKET };
