import { describe, expect, it } from "vitest";
import { Chatter, type MessageCreatedEvent } from "../../src/index.js";
import { FakeAccountAdapter } from "@chatter/testing";

describe("multi-account isolation", () => {
  it("attributes inbound events and outbound sends to the correct account", async () => {
    const botA = new FakeAccountAdapter();
    const botB = new FakeAccountAdapter();
    const chatter = new Chatter({
      accounts: [
        { accountName: "bot-a", adapter: botA },
        { accountName: "bot-b", adapter: botB },
      ],
    });

    const received: MessageCreatedEvent[] = [];
    chatter.on("message.created", (event) => {
      received.push(event);
    });

    await chatter.start();

    const conversationA = {
      provider: "fake",
      providerAccountId: "acct-a",
      providerConversationId: "dm-a",
      type: "direct" as const,
    };
    const conversationB = {
      provider: "fake",
      providerAccountId: "acct-b",
      providerConversationId: "dm-b",
      type: "direct" as const,
    };

    botA.emitInbound({
      id: "msg-a",
      provider: "fake",
      sender: { provider: "fake", providerAccountId: "acct-a", providerParticipantId: "user-a" },
      conversation: conversationA,
      text: "hello from A",
      createdAt: new Date(),
    });
    botB.emitInbound({
      id: "msg-b",
      provider: "fake",
      sender: { provider: "fake", providerAccountId: "acct-b", providerParticipantId: "user-b" },
      conversation: conversationB,
      text: "hello from B",
      createdAt: new Date(),
    });

    expect(received).toHaveLength(2);
    const eventA = received.find((e) => e.message.id === "msg-a");
    const eventB = received.find((e) => e.message.id === "msg-b");
    expect(eventA?.account).toBe("bot-a");
    expect(eventB?.account).toBe("bot-b");

    await chatter.send({ account: "bot-a", conversation: conversationA, text: "reply from A" });
    await chatter.send({ account: "bot-b", conversation: conversationB, text: "reply from B" });

    expect(botA.sentMessages).toHaveLength(1);
    expect(botB.sentMessages).toHaveLength(1);
    expect(botA.sentMessages[0]?.conversation.providerConversationId).toBe("dm-a");
    expect(botB.sentMessages[0]?.conversation.providerConversationId).toBe("dm-b");

    await chatter.stop();
  });

  it("rejects sending on a conversation only known to a different account", async () => {
    const botA = new FakeAccountAdapter();
    const botB = new FakeAccountAdapter();
    const chatter = new Chatter({
      accounts: [
        { accountName: "bot-a", adapter: botA },
        { accountName: "bot-b", adapter: botB },
      ],
    });
    await chatter.start();

    const conversationA = {
      provider: "fake",
      providerAccountId: "acct-a",
      providerConversationId: "dm-a",
      type: "direct" as const,
    };
    botA.emitInbound({
      id: "msg-a",
      provider: "fake",
      sender: { provider: "fake", providerAccountId: "acct-a", providerParticipantId: "user-a" },
      conversation: conversationA,
      text: "hello",
      createdAt: new Date(),
    });

    await expect(
      chatter.send({ account: "bot-b", conversation: conversationA, text: "leaked reply" }),
    ).rejects.toThrow();

    await chatter.stop();
  });
});
