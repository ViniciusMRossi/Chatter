import { describe, expect, it } from "vitest";
import { Chatter, ChatterUnsupportedCapabilityError, type Attachment, type MessageCreatedEvent } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

describe("attachment round trip via the fake adapter", () => {
  it("dispatches an attachment-only inbound message with attachments intact and text undefined", async () => {
    const fake = new FakeAccountAdapter();
    const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter: fake }] });

    const received: MessageCreatedEvent[] = [];
    chatter.on("message.created", (event) => {
      received.push(event);
    });

    await chatter.start();

    const attachment: Attachment = { kind: "image", source: { url: "https://example.com/cat.png" } };
    fake.emitInbound({
      id: "msg-1",
      provider: "fake",
      sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
      conversation: {
        provider: "fake",
        providerAccountId: "acct-1",
        providerConversationId: "dm-1",
        type: "direct",
      },
      attachments: [attachment],
      createdAt: new Date(),
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.message.text).toBeUndefined();
    expect(received[0]?.message.attachments).toEqual([attachment]);

    await chatter.stop();
  });

  it("forwards an outbound attachment from chatter.send() through to the adapter", async () => {
    const fake = new FakeAccountAdapter({ capabilities: ["text", "attachments"] });
    const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter: fake }] });
    await chatter.start();

    fake.emitInbound({
      id: "msg-1",
      provider: "fake",
      sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
      conversation: {
        provider: "fake",
        providerAccountId: "acct-1",
        providerConversationId: "dm-1",
        type: "direct",
      },
      text: "hello",
      createdAt: new Date(),
    });

    const attachment: Attachment = { kind: "file", source: { data: Buffer.from("hello world") } };
    const result = await chatter.send({
      account: "support-bot",
      conversation: {
        provider: "fake",
        providerAccountId: "acct-1",
        providerConversationId: "dm-1",
        type: "direct",
      },
      attachment,
    });

    expect(result).toBeTruthy();
    expect(fake.sentMessages).toHaveLength(1);
  });

  it("rejects an attachment send against an account that does not declare attachments", async () => {
    const fake = new FakeAccountAdapter({ capabilities: ["text"] });
    const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter: fake }] });
    await chatter.start();

    fake.emitInbound({
      id: "msg-1",
      provider: "fake",
      sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
      conversation: {
        provider: "fake",
        providerAccountId: "acct-1",
        providerConversationId: "dm-1",
        type: "direct",
      },
      text: "hello",
      createdAt: new Date(),
    });

    await expect(
      chatter.send({
        account: "support-bot",
        conversation: {
          provider: "fake",
          providerAccountId: "acct-1",
          providerConversationId: "dm-1",
          type: "direct",
        },
        attachment: { kind: "file", source: { data: Buffer.from("x") } },
      }),
    ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);

    expect(fake.sentMessages).toHaveLength(0);
  });
});
