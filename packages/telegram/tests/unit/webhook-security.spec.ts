import type { InboundMessage } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";

async function setUp() {
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
  return { handler, received };
}

function webhookRequest(secretHeader?: string): Request {
  return new Request("https://example.com/telegram-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secretHeader !== undefined ? { "X-Telegram-Bot-Api-Secret-Token": secretHeader } : {}),
    },
    body: JSON.stringify({
      update_id: 3,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 1, type: "private", first_name: "Eve" },
        from: { id: 2, is_bot: false, first_name: "Eve" },
        text: "should not be dispatched",
      },
    }),
  });
}

describe("webhook security", () => {
  it("rejects a request with no secret header and dispatches nothing", async () => {
    const { handler, received } = await setUp();

    const response = await handler(webhookRequest());

    expect(response.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it("rejects a request with an incorrect secret and dispatches nothing", async () => {
    const { handler, received } = await setUp();

    const response = await handler(webhookRequest("wrong-secret"));

    expect(response.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it("accepts a request with the correct secret and dispatches normally", async () => {
    const { handler, received } = await setUp();

    const response = await handler(webhookRequest(WEBHOOK_SECRET));

    expect(response.status).toBe(200);
    expect(received).toHaveLength(1);
  });
});
