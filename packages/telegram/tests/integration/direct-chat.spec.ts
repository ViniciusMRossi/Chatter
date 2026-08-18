import type { InboundMessage } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";

describe("direct chat round trip", () => {
  it("dispatches a normalized inbound message and records a correctly-shaped reply send", async () => {
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
    const update = {
      update_id: 1,
      message: {
        message_id: 42,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        text: "hello",
      },
    };

    const response = await handler(
      new Request("https://example.com/telegram-webhook", {
        method: "POST",
        headers: {
          "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET,
          "content-type": "application/json",
        },
        body: JSON.stringify(update),
      }),
    );

    expect(response.status).toBe(200);
    expect(received).toHaveLength(1);
    expect(received[0]?.conversation.type).toBe("direct");
    expect(received[0]?.text).toBe("hello");
    expect(received[0]?.id).toBe("42");

    const inbound = received[0];
    if (!inbound) {
      throw new Error("expected an inbound message");
    }

    const result = await adapter.send({
      conversation: inbound.conversation,
      text: "echo: hello",
      replyToMessageId: inbound.id,
    });

    expect(result.provider).toBe("telegram");
    expect(result.conversation.providerConversationId).toBe("555");

    const sendCall = transport.calls.find((call) => call.method === "sendMessage");
    expect(sendCall?.payload.chat_id).toBe(555);
    expect(sendCall?.payload.reply_parameters).toMatchObject({ message_id: 42 });

    await adapter.stop();
  });
});
