import type { InboundMessage, Participant } from "@chatter/core";
import type { Message as TelegramMessage } from "@grammyjs/types";
import { mapConversation } from "./conversation.js";
import { mapParticipant } from "./participant.js";

/** A Telegram message known (by the caller) to carry text. */
export type TelegramTextMessage = TelegramMessage & { text: string };

const UNKNOWN_SENDER_ID = "unknown";

export function mapMessage(
  message: TelegramTextMessage,
  providerAccountId: string,
): InboundMessage {
  const sender: Participant = message.from
    ? mapParticipant(message.from, providerAccountId)
    : { provider: "telegram", providerAccountId, providerParticipantId: UNKNOWN_SENDER_ID };

  return {
    id: String(message.message_id),
    provider: "telegram",
    sender,
    conversation: mapConversation(message.chat, providerAccountId),
    text: message.text,
    createdAt: new Date(message.date * 1000),
    ...(message.reply_to_message
      ? { replyToMessageId: String(message.reply_to_message.message_id) }
      : {}),
  };
}
