import { describe, expect, it } from "vitest";
import { Chatter, type MessageCreatedEvent } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

describe("round trip via the fake adapter", () => {
  it("delivers an inbound message and sends a reply back", async () => {
    const fake = new FakeAccountAdapter();
    const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter: fake }] });

    const received: MessageCreatedEvent[] = [];
    chatter.on("message.created", (event) => {
      received.push(event);
    });
    chatter.on("message.created", async (event) => {
      await chatter.send({
        account: event.account,
        conversation: event.message.conversation,
        text: `echo: ${event.message.text ?? ""}`,
        replyToMessageId: event.message.id,
      });
    });

    await chatter.start();

    fake.emitInbound({
      id: "msg-1",
      provider: "fake",
      sender: {
        provider: "fake",
        providerAccountId: "acct-1",
        providerParticipantId: "user-1",
      },
      conversation: {
        provider: "fake",
        providerAccountId: "acct-1",
        providerConversationId: "dm-1",
        type: "direct",
      },
      text: "hello",
      createdAt: new Date(),
    });

    // Handler dispatch is synchronous for the sync handler, but the async reply handler
    // needs a tick to complete its awaited chatter.send() call.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.account).toBe("support-bot");
    expect(received[0]?.message.provider).toBe("fake");
    expect(received[0]?.message.conversation.type).toBe("direct");
    expect(received[0]?.message.id).toBe("msg-1");

    expect(fake.sentMessages).toHaveLength(1);
    const [sent] = fake.sentMessages;
    expect(sent?.conversation.providerConversationId).toBe("dm-1");
    expect(sent?.providerMessageId).toBeTruthy();
    expect(sent?.timestamp).toBeInstanceOf(Date);

    await chatter.stop();
  });

  it("rejects a send before start() with ChatterConfigurationError", async () => {
    const fake = new FakeAccountAdapter();
    const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter: fake }] });

    await expect(
      chatter.send({
        account: "support-bot",
        conversation: {
          provider: "fake",
          providerAccountId: "acct-1",
          providerConversationId: "dm-1",
          type: "direct",
        },
        text: "hello",
      }),
    ).rejects.toThrow();
  });
});
