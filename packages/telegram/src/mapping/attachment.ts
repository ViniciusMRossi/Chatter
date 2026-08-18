import type { Attachment, AttachmentKind } from "@chatter/core";
import type { Document, PhotoSize, Video } from "@grammyjs/types";
import type { Api } from "grammy";

type TelegramMedia = PhotoSize | Video | Document;

function hasFileName(media: TelegramMedia): media is Video | Document {
  return "file_name" in media;
}

/**
 * Resolves Telegram's opaque `file_id` to a real, directly-usable download URL via `getFile`
 * before constructing the normalized `Attachment` — `file_id`/`file_unique_id` never reach the
 * result (see specs/005-telegram-attachment-mapping/research.md). The returned URL embeds the
 * bot token (Telegram's own file-download mechanism); callers must treat it as sensitive.
 */
export async function mapAttachment(
  media: TelegramMedia,
  kind: AttachmentKind,
  api: Api,
  botToken: string,
): Promise<Attachment> {
  const file = await api.getFile(media.file_id);
  if (file.file_path === undefined) {
    throw new Error(`Telegram getFile returned no file_path for file_id ${media.file_id}`);
  }
  const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

  return {
    kind,
    source: { url },
    ...(hasFileName(media) && media.file_name !== undefined ? { fileName: media.file_name } : {}),
    ...(hasFileName(media) && media.mime_type !== undefined ? { mimeType: media.mime_type } : {}),
    ...(media.file_size !== undefined ? { sizeBytes: media.file_size } : {}),
  };
}
