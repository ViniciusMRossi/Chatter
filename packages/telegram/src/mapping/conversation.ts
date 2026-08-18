import type { Conversation, ConversationType } from "@chatter/core";
import type { Chat } from "@grammyjs/types";

export function mapChatType(chatType: Chat["type"]): ConversationType {
  switch (chatType) {
    case "private":
      return "direct";
    case "group":
    case "supergroup":
      return "group";
    case "channel":
    default:
      // Telegram channels are out of scope this ticket (spec.md Assumptions); map
      // defensively rather than crash on an unexpected-but-valid provider payload.
      return "unknown";
  }
}

export function mapConversation(chat: Chat, providerAccountId: string): Conversation {
  return {
    provider: "telegram",
    providerAccountId,
    providerConversationId: String(chat.id),
    type: mapChatType(chat.type),
  };
}
