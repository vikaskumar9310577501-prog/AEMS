/** Client helpers for opening uploaded documents and scan PDFs reliably. */

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([^/?#]+)/i,
    /[?&]id=([^&]+)/i,
    /\/uc\?[^#]*\bid=([^&]+)/i,
  ];
  for (const re of patterns) {
    const m = url.trim().match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Inline PDF/image viewer through AssestFlow server (fixes blank Drive tabs). */
export function getDocumentViewUrl(storedUrl?: string): string {
  const trimmed = (storedUrl || "").trim();
  if (!trimmed) return "";
  const id = extractDriveFileId(trimmed);
  if (id) {
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  if (trimmed.startsWith("/api/file/view")) {
    return `${window.location.origin}${trimmed}`;
  }
  return trimmed;
}

/** Get raw image URL for standard HTML <img> tags (resolves Drive file IDs to direct view stream). */
export function getDeviceImageUrl(storedUrl?: string): string {
  const trimmed = (storedUrl || "").trim();
  if (!trimmed) return "";
  const id = extractDriveFileId(trimmed);
  if (id) {
    return `/api/file/view?id=${id}`;
  }
  if (trimmed.startsWith("/api/file/view")) {
    return `${window.location.origin}${trimmed}`;
  }
  return trimmed;
}

export function isPdfDocumentUrl(url?: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".pdf") || u.includes("application/pdf") || u.includes("export=download");
}
