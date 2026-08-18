import { describe, expect, it } from "vitest";
import { mapChatType, mapConversation } from "../../src/mapping/conversation.js";

describe("Telegram chat -> Conversation mapping", () => {
  it('maps chat.type "private" to conversation type "direct"', () => {
    expect(mapChatType("private")).toBe("direct");
  });

  it('mapConversation() reports type "direct" for a private chat', () => {
    const conversation = mapConversation(
      { id: 123, type: "private", first_name: "Ada" },
      "987654321",
    );
    expect(conversation.type).toBe("direct");
    expect(conversation.provider).toBe("telegram");
    expect(conversation.providerAccountId).toBe("987654321");
    expect(conversation.providerConversationId).toBe("123");
  });

  it('maps chat.type "group" and "supergroup" to conversation type "group"', () => {
    expect(mapChatType("group")).toBe("group");
    expect(mapChatType("supergroup")).toBe("group");
  });

  it('mapConversation() reports type "group" for a group chat, distinct from a direct one', () => {
    const group = mapConversation({ id: 456, type: "group", title: "Team" }, "987654321");
    const direct = mapConversation({ id: 123, type: "private", first_name: "Ada" }, "987654321");
    expect(group.type).toBe("group");
    expect(group.providerConversationId).not.toBe(direct.providerConversationId);
  });
});
