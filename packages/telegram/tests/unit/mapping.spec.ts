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
});
