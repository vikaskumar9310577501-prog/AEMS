import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getUploadedFile, saveUploadedFile } from "./sqlStore.js";
import { isSupabaseMode } from "./sqlConfig.js";
import { downloadFromStorage, uploadToStorage } from "./supabaseClient.js";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function saveLocalUpload(opts: {
  filename: string;
  mimeType: string;
  base64Data: string;
}): Promise<{ fileId: string; url: string; viewUrl: string; fileName: string }> {
  const fileId = `local-${crypto.randomUUID()}`;
  if (isSupabaseMode()) {
    const ext = path.extname(opts.filename) || "";
    const storagePath = `${fileId}${ext}`;
    const url = await uploadToStorage(storagePath, Buffer.from(opts.base64Data, "base64"), opts.mimeType);
    await saveUploadedFile({
      fileId,
      fileName: opts.filename,
      mimeType: opts.mimeType,
      diskPath: storagePath,
      url,
    });
    return { fileId, url, viewUrl: url, fileName: opts.filename };
  }
  ensureUploadDir();
  const ext = path.extname(opts.filename) || "";
  const diskName = `${fileId}${ext}`;
  const diskPath = path.join(UPLOAD_DIR, diskName);
  fs.writeFileSync(diskPath, Buffer.from(opts.base64Data, "base64"));
  const viewUrl = `/api/file/view?id=${encodeURIComponent(fileId)}`;
  await saveUploadedFile({
    fileId,
    fileName: opts.filename,
    mimeType: opts.mimeType,
    diskPath,
    url: viewUrl,
  });
  return { fileId, url: viewUrl, viewUrl, fileName: opts.filename };
}

export async function readLocalUpload(fileId: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
} | null> {
  const record = await getUploadedFile(fileId);
  if (!record) return null;
  if (isSupabaseMode() && record.diskPath) {
    const remote = await downloadFromStorage(record.diskPath);
    if (!remote) return null;
    return { bytes: remote.bytes, contentType: remote.contentType || record.mimeType, fileName: record.fileName };
  }
  if (!record.diskPath || !fs.existsSync(record.diskPath)) return null;
  const bytes = new Uint8Array(fs.readFileSync(record.diskPath));
  return { bytes, contentType: record.mimeType || "application/octet-stream", fileName: record.fileName };
}
