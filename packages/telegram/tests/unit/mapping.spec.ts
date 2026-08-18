import { describe, expect, it } from "vitest";
import { mapAttachment } from "../../src/mapping/attachment.js";
import { mapChatType, mapConversation } from "../../src/mapping/conversation.js";
import { mapMessage } from "../../src/mapping/message.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const BOT_TOKEN = "test-token";

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

describe("Telegram media -> Attachment mapping", () => {
  it("maps a PhotoSize to an image attachment with a resolved, non-file_id URL", async () => {
    const transport = new StubTelegramTransport();
    const photo = { file_id: "photo-1", file_unique_id: "photo-1-u", width: 800, height: 800 };

    const attachment = await mapAttachment(photo, "image", transport.api, BOT_TOKEN);

    expect(attachment.kind).toBe("image");
    expect("url" in attachment.source && attachment.source.url).toContain(BOT_TOKEN);
    expect("url" in attachment.source && attachment.source.url).not.toContain("photo-1-u");
    expect(JSON.stringify(attachment)).not.toContain("file_id");
  });

  it("maps a Document, populating only fields Telegram actually supplied", async () => {
    const transport = new StubTelegramTransport();
    const document = {
      file_id: "doc-1",
      file_unique_id: "doc-1-u",
      file_name: "report.pdf",
      mime_type: "application/pdf",
      file_size: 2048,
    };

    const attachment = await mapAttachment(document, "file", transport.api, BOT_TOKEN);

    expect(attachment.kind).toBe("file");
    expect(attachment.fileName).toBe("report.pdf");
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.sizeBytes).toBe(2048);
  });

  it("maps a Video without a fileName/mimeType Telegram didn't supply", async () => {
    const transport = new StubTelegramTransport();
    const video = { file_id: "vid-1", file_unique_id: "vid-1-u", width: 100, height: 100, duration: 5 };

    const attachment = await mapAttachment(video, "video", transport.api, BOT_TOKEN);

    expect(attachment.kind).toBe("video");
    expect(attachment.fileName).toBeUndefined();
    expect(attachment.mimeType).toBeUndefined();
  });

  it("resolves the largest PhotoSize when a message carries multiple resolutions", async () => {
    const transport = new StubTelegramTransport();
    const message = {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 555, type: "private" as const, first_name: "Ada" },
      from: { id: 777, is_bot: false, first_name: "Ada" },
      photo: [
        { file_id: "small", file_unique_id: "small-u", width: 90, height: 90 },
        { file_id: "large", file_unique_id: "large-u", width: 800, height: 800 },
      ],
    };

    const mapped = await mapMessage(message, "987654321", transport.api, BOT_TOKEN);

    const getFileCall = transport.calls.find((call) => call.method === "getFile");
    expect(getFileCall?.payload.file_id).toBe("large");
    expect(mapped.attachments?.[0]?.kind).toBe("image");
  });
});
