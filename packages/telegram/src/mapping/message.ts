import type { Attachment, InboundMessage, Participant } from "@chatter/core";
import type { Message as TelegramMessage } from "@grammyjs/types";
import type { Api } from "grammy";
import { mapAttachment } from "./attachment.js";
import { mapConversation } from "./conversation.js";
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
): Promise<InboundMessage> {
  const sender: Participant = message.from
    ? mapParticipant(message.from, providerAccountId)
    : { provider: "telegram", providerAccountId, providerParticipantId: UNKNOWN_SENDER_ID };

  const attachment = await mapMessageAttachment(message, api, botToken);
  const text = attachment !== undefined ? message.caption : message.text;

  return {
    id: String(message.message_id),
    provider: "telegram",
    sender,
    conversation: mapConversation(message.chat, providerAccountId),
    ...(text !== undefined ? { text } : {}),
    ...(attachment !== undefined ? { attachments: [attachment] } : {}),
    createdAt: new Date(message.date * 1000),
    ...(message.reply_to_message
      ? { replyToMessageId: String(message.reply_to_message.message_id) }
      : {}),
  };
}
