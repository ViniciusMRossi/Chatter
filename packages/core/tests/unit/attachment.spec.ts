import { describe, expect, it } from "vitest";
import type { Attachment, Message } from "@chatter/core";

const sender = { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" };
const conversation = {
  provider: "fake",
  providerAccountId: "acct-1",
  providerConversationId: "dm-1",
  type: "direct" as const,
};

describe("Attachment representation on Message", () => {
  it("holds both text and attachments together", () => {
    const attachment: Attachment = {
      kind: "image",
      source: { url: "https://example.com/cat.png" },
      mimeType: "image/png",
    };
    const message: Message = {
      id: "msg-1",
      provider: "fake",
      account: "support-bot",
      sender,
      conversation,
      text: "check this out",
      attachments: [attachment],
      createdAt: new Date(),
    };

    expect(message.text).toBe("check this out");
    expect(message.attachments).toEqual([attachment]);
  });

  it("holds an attachment with no text (no caption required)", () => {
    const attachment: Attachment = { kind: "video", source: { url: "https://example.com/clip.mp4" } };
    const message: Message = {
      id: "msg-2",
      provider: "fake",
      account: "support-bot",
      sender,
      conversation,
      attachments: [attachment],
      createdAt: new Date(),
    };

    expect(message.text).toBeUndefined();
    expect(message.attachments).toEqual([attachment]);
  });

  it("holds text with no attachments", () => {
    const message: Message = {
      id: "msg-3",
      provider: "fake",
      account: "support-bot",
      sender,
      conversation,
      text: "hello",
      createdAt: new Date(),
    };

    expect(message.text).toBe("hello");
    expect(message.attachments).toBeUndefined();
  });

  it("is valid with only kind and source set", () => {
    const attachment: Attachment = { kind: "file", source: { url: "https://example.com/report.pdf" } };

    expect(attachment.fileName).toBeUndefined();
    expect(attachment.mimeType).toBeUndefined();
    expect(attachment.sizeBytes).toBeUndefined();
  });
});
