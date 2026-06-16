import {
  driveDownloadUrl,
  driveViewUrl,
  extractDriveFileId,
  toDriveDirectUrl,
} from "./driveUrls.js";
import { getEnv } from "./env.js";
export type FetchedFile = {
  bytes: Uint8Array;
  contentType: string;
};

const ALLOWED_REMOTE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "lh3.googleusercontent.com",
]);

export function isAllowedRemoteUrl(url: string): boolean {
  try {
    const trimmed = (url || "").trim();
    if (!trimmed) return false;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const hostOk = [...ALLOWED_REMOTE_HOSTS].some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
    if (!hostOk) return false;
    return extractDriveFileId(trimmed) !== null || host.includes("googleusercontent.com");
  } catch {
    return false;
  }
}

function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function isPngBytes(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function extractDriveConfirmToken(html: string): string | null {
  const patterns = [
    /confirm=([0-9A-Za-z_\-]+)/,
    /confirm=([0-9A-Za-z_\-]{4,})/,
    /id="download-form"[^>]*action="[^"]*confirm=([0-9A-Za-z_\-]+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  if (html.includes("virus scan") || html.includes("download_warning")) return "t";
  return null;
}

async function fetchWithRedirects(url: string, maxRedirects = 8): Promise<Response> {
  let current = url;
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AssestFlow/1.0)" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      const next = loc.startsWith("http") ? loc : new URL(loc, current).toString();
      if (!isAllowedRemoteUrl(next)) return res;
      current = next;
      continue;
    }
    return res;
  }
  return fetch(current, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AssestFlow/1.0)" },
  });
}

async function fetchUrlOnce(url: string): Promise<FetchedFile | null> {
  if (!isAllowedRemoteUrl(url)) return null;

  let res = await fetchWithRedirects(url);
  if (!res.ok) return null;

  let contentType = res.headers.get("content-type") || "";
  let bytes = new Uint8Array(await res.arrayBuffer());

  if (contentType.includes("text/html") && bytes.length > 0 && !isPdfBytes(bytes)) {
    const html = new TextDecoder().decode(bytes.slice(0, 200000));
    const confirm = extractDriveConfirmToken(html);
    const fileId = extractDriveFileId(url);
    if (confirm && fileId) {
      const retryUrl = `${driveDownloadUrl(fileId)}&confirm=${confirm}`;
      res = await fetchWithRedirects(retryUrl);
      if (!res.ok) return null;
      contentType = res.headers.get("content-type") || "";
      bytes = new Uint8Array(await res.arrayBuffer());
    }
  }

  if (bytes.length === 0) return null;
  if (isPdfBytes(bytes)) contentType = "application/pdf";
  else if (isPngBytes(bytes)) contentType = "image/png";
  else if (isJpegBytes(bytes)) contentType = "image/jpeg";

  if (contentType.includes("text/html")) return null;

  return { bytes, contentType };
}

/**
 * Fetch file bytes from Google Drive URLs only.
 * Tries GAS proxy first, then Drive download/view URLs.
 */
export async function fetchRemoteFile(url: string): Promise<FetchedFile | null> {
  try {
    const trimmed = (url || "").trim();
    if (!trimmed) return null;

    const fileId = extractDriveFileId(trimmed);
    if (!fileId && !isAllowedRemoteUrl(trimmed)) return null;

    const gasUrl = getEnv("GAS_WEBAPP_URL");
    if (fileId && gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_file_base64", fileId }),
        });
        const data = (await response.json()) as {
          success?: boolean;
          base64?: string;
          mimeType?: string;
          error?: string;
        };
        if (data?.success && data.base64) {
          const bytes = Buffer.from(data.base64, "base64");
          return {
            bytes: new Uint8Array(bytes),
            contentType: data.mimeType || "application/octet-stream",
          };
        }
      } catch (err) {
        console.warn(`GAS fetch error for file ${fileId}:`, err);
      }
    }

    const attempts: string[] = [];
    if (fileId) {
      attempts.push(driveDownloadUrl(fileId), driveViewUrl(fileId));
    }
    if (isAllowedRemoteUrl(trimmed)) {
      attempts.push(toDriveDirectUrl(trimmed));
    }

    for (const attempt of attempts) {
      const data = await fetchUrlOnce(attempt);
      if (data) return data;
    }
    return null;
  } catch (err) {
    console.warn("fetchRemoteFile failed:", err);
    return null;
  }
}
