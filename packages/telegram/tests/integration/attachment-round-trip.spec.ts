import type { InboundMessage } from "@chatter/core";
import { ChatterConfigurationError } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";

async function setUp(): Promise<{
  adapter: TelegramAccountAdapter;
  transport: StubTelegramTransport;
  handler: (request: Request) => Promise<Response>;
  received: InboundMessage[];
}> {
  const transport = new StubTelegramTransport();
  const adapter = new TelegramAccountAdapter(
    {
      botToken: "test-token",
      webhookSecret: WEBHOOK_SECRET,
      webhookUrl: "https://example.com/telegram-webhook",
    },
    { api: transport.api },
  );
  const received: InboundMessage[] = [];
  await adapter.start((message) => {
    received.push(message);
  });
  const handler = createTelegramWebhookHandler(adapter);
  return { adapter, transport, handler, received };
}

function postUpdate(
  handler: (request: Request) => Promise<Response>,
  update: unknown,
): Promise<Response> {
  return handler(
    new Request("https://example.com/telegram-webhook", {
      method: "POST",
      headers: {
        "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET,
        "content-type": "application/json",
      },
      body: JSON.stringify(update),
    }),
  );
}

describe("inbound attachment round trip", () => {
  it("dispatches a photo with a caption as an image attachment plus text", async () => {
    const { handler, received } = await setUp();

    const response = await postUpdate(handler, {
      update_id: 1,
      message: {
        message_id: 10,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        photo: [{ file_id: "photo-1", file_unique_id: "photo-1-u", width: 800, height: 800 }],
        caption: "check this out",
      },
    });

    expect(response.status).toBe(200);
    expect(received).toHaveLength(1);
    expect(received[0]?.attachments?.[0]?.kind).toBe("image");
    expect(received[0]?.text).toBe("check this out");
  });

  it("dispatches a photo with no caption as an attachment-only message", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 2,
      message: {
        message_id: 11,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        photo: [{ file_id: "photo-2", file_unique_id: "photo-2-u", width: 800, height: 800 }],
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.attachments?.[0]?.kind).toBe("image");
    expect(received[0]?.text).toBeUndefined();
  });

  it("dispatches a video as a video attachment", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 3,
      message: {
        message_id: 12,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        video: { file_id: "vid-1", file_unique_id: "vid-1-u", width: 100, height: 100, duration: 5 },
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.attachments?.[0]?.kind).toBe("video");
  });

  it("dispatches a document as a file attachment", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 4,
      message: {
        message_id: 13,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        document: { file_id: "doc-1", file_unique_id: "doc-1-u", file_name: "report.pdf" },
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.attachments?.[0]?.kind).toBe("file");
  });

  it("dispatches a voice message (previously silently dropped) as a file attachment", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 5,
      message: {
        message_id: 14,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        voice: { file_id: "voice-1", file_unique_id: "voice-1-u", duration: 3, mime_type: "audio/ogg" },
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.attachments?.[0]?.kind).toBe("file");
    expect(received[0]?.attachments?.[0]?.mimeType).toBe("audio/ogg");
  });

  it("dispatches an audio (music file) message as a file attachment", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 6,
      message: {
        message_id: 15,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        audio: {
          file_id: "audio-1",
          file_unique_id: "audio-1-u",
          duration: 180,
          mime_type: "audio/mpeg",
          file_name: "song.mp3",
        },
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.attachments?.[0]?.kind).toBe("file");
    expect(received[0]?.attachments?.[0]?.fileName).toBe("song.mp3");
  });
});

describe("outbound attachment sends", () => {
  it("sends a { url }-sourced image attachment via sendPhoto, no bytes read", async () => {
    const { adapter, transport } = await setUp();

    const result = await adapter.send({
      conversation: {
        provider: "telegram",
        providerAccountId: "987654321",
        providerConversationId: "555",
        type: "direct",
      },
      attachment: { kind: "image", source: { url: "https://example.com/cat.png" } },
    });

    expect(result.provider).toBe("telegram");
    const call = transport.calls.find((c) => c.method === "sendPhoto");
    expect(call?.payload.photo).toBe("https://example.com/cat.png");
  });

  it("sends a { data } attachment via the InputFile path, wrapped for the correct method", async () => {
    const { adapter, transport } = await setUp();

    await adapter.send({
      conversation: {
        provider: "telegram",
        providerAccountId: "987654321",
        providerConversationId: "555",
        type: "direct",
      },
      attachment: { kind: "file", source: { data: Buffer.from("hello") }, fileName: "hello.txt" },
    });

    const call = transport.calls.find((c) => c.method === "sendDocument");
    expect(call).toBeDefined();
  });

  it("passes text as caption when sending an attachment with accompanying text", async () => {
    const { adapter, transport } = await setUp();

    await adapter.send({
      conversation: {
        provider: "telegram",
        providerAccountId: "987654321",
        providerConversationId: "555",
        type: "direct",
      },
      text: "here's the file",
      attachment: { kind: "file", source: { data: Buffer.from("hello") } },
    });

    const call = transport.calls.find((c) => c.method === "sendDocument");
    expect(call?.payload.caption).toBe("here's the file");
  });

  it("sends an attachment-only message with no caption set", async () => {
    const { adapter, transport } = await setUp();

    await adapter.send({
      conversation: {
        provider: "telegram",
        providerAccountId: "987654321",
        providerConversationId: "555",
        type: "direct",
      },
      attachment: { kind: "file", source: { data: Buffer.from("hello") } },
    });

    const call = transport.calls.find((c) => c.method === "sendDocument");
    expect(call?.payload.caption).toBeUndefined();
  });

  it("rejects a send with neither text nor an attachment", async () => {
    const { adapter } = await setUp();

    await expect(
      adapter.send({
        conversation: {
          provider: "telegram",
          providerAccountId: "987654321",
          providerConversationId: "555",
          type: "direct",
        },
      }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);
  });
});
