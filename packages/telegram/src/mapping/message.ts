import type { Attachment, InboundMessage, Participant } from "@chatter/core";
import type { Message as TelegramMessage } from "@grammyjs/types";
import type { Api } from "grammy";
import { mapAttachment } from "./attachment.js";
import { mapConversation } from "./conversation.js";
import { mapMentions } from "./mention.js";
import { mapParticipant } from "./participant.js";

const UNKNOWN_SENDER_ID = "unknown";

async function mapMessageAttachment(
  message: TelegramMessage,
  api: Api,
  botToken: string,
): Promise<Attachment | undefined> {
  if (message.photo !== undefined) {
    const largest = message.photo[message.photo.length - 1];
    if (largest === undefined) {
      return undefined;
    }
    return mapAttachment(largest, "image", api, botToken);
  }
  if (message.video !== undefined) {
    return mapAttachment(message.video, "video", api, botToken);
  }
  if (message.document !== undefined) {
    return mapAttachment(message.document, "file", api, botToken);
  }
  if (message.voice !== undefined) {
    // No "audio" Capability/kind — reuses "file" (mimeType, typically "audio/ogg", is what
    // lets application code recognize it's playable audio; see packages/telegram/README.md).
    return mapAttachment(message.voice, "file", api, botToken);
  }
  if (message.audio !== undefined) {
    return mapAttachment(message.audio, "file", api, botToken);
  }
  return undefined;
}

export async function mapMessage(
  message: TelegramMessage,
  providerAccountId: string,
  api: Api,
  botToken: string,
  botUsername?: string,
  onNonFatalError?: (message: string) => void,
): Promise<InboundMessage> {
  const sender: Participant = message.from
    ? mapParticipant(message.from, providerAccountId)
    : { provider: "telegram", providerAccountId, providerParticipantId: UNKNOWN_SENDER_ID };

  const attachment = await mapMessageAttachment(message, api, botToken);
  // Telegram supplies a separate entity array per text field: `entities` indexes into `text`,
  // `caption_entities` indexes into `caption`. Both are chosen by the SAME decision here on
  // purpose — picking them independently lets offsets and the string they index into drift
  // apart, which produces mentions whose text disagrees with their own position without
  // throwing anything.
  const { text, entities } =
    attachment !== undefined
      ? { text: message.caption, entities: message.caption_entities }
      : { text: message.text, entities: message.entities };

  const mentions = mapMentions(entities, text, providerAccountId, botUsername, onNonFatalError);

  return {
    id: String(message.message_id),
    provider: "telegram",
    sender,
    conversation: mapConversation(message.chat, providerAccountId),
    ...(text !== undefined ? { text } : {}),
    ...(attachment !== undefined ? { attachments: [attachment] } : {}),
    ...(mentions !== undefined ? { mentions } : {}),
    createdAt: new Date(message.date * 1000),
    // `date` is when it was originally sent and never moves; `edit_date` appears only once
    // the message has been edited. The key is omitted entirely when absent, so a
    // never-edited message keeps exactly the shape it had before edits existed.
    ...(message.edit_date !== undefined
      ? { editedAt: new Date(message.edit_date * 1000) }
      : {}),
    ...(message.reply_to_message
      ? { replyToMessageId: String(message.reply_to_message.message_id) }
      : {}),
  };
}
