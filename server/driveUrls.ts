/** Google Drive URL helpers for PDF view/download and server-side fetch. */

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /\/file\/d\/([^/?#]+)/i,
    /[?&]id=([^&]+)/i,
    /\/uc\?[^#]*\bid=([^&]+)/i,
    /\/open\?[^#]*\bid=([^&]+)/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function drivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Convert any Drive sharing link to a direct download URL. */
export function toDriveDirectUrl(url: string): string {
  if (!url) return url;
  const id = extractDriveFileId(url);
  if (id) return driveDownloadUrl(id);
  return url;
}

/** App-relative URL that streams PDF/images inline (fixes Drive viewer / blank tab issues). */
export function toAppFileViewUrl(
  storedUrl: string,
  baseUrl = ""
): string {
  const trimmed = (storedUrl || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/api/file/view")) {
    return `${baseUrl.replace(/\/$/, "")}${trimmed}`;
  }
  const id = extractDriveFileId(trimmed);
  const q = id
    ? `id=${encodeURIComponent(id)}`
    : `url=${encodeURIComponent(trimmed)}`;
  return `${baseUrl.replace(/\/$/, "")}/api/file/view?${q}`;
}
