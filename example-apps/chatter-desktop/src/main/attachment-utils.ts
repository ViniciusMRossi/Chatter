import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXTENSION_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

export type AttachmentKind = "image" | "video" | "file";

/** Best-effort MIME type from a file extension — no new dependency for a tiny example app. */
export function mimeTypeFromFileName(fileName: string): string | undefined {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MIME_TYPES[extension];
}

export function kindFromMimeType(mimeType: string | undefined): AttachmentKind {
  if (mimeType?.startsWith("image/")) {
    return "image";
  }
  if (mimeType?.startsWith("video/")) {
    return "video";
  }
  return "file";
}

export function dataUrlFromBuffer(data: Buffer, mimeType: string | undefined): string {
  return `data:${mimeType ?? "application/octet-stream"};base64,${data.toString("base64")}`;
}

/**
 * Fetches a URL's bytes in the main process — the ONLY place a resolved Telegram download URL
 * (which embeds the bot token, see specs/005-telegram-attachment-mapping/README.md) is ever
 * used. The renderer never receives this URL, only bytes/data-URLs derived from it.
 */
export async function fetchAttachmentBytes(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download attachment: HTTP ${String(response.status)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Writes bytes to a fresh temp file and returns its path, for shell.openPath(). */
export async function writeToTempFile(data: Buffer, fileName: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "chatter-desktop-"));
  const path = join(dir, fileName);
  await writeFile(path, data);
  return path;
}
