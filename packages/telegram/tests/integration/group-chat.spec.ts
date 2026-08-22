import type { InboundMessage } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";

describe("group chat round trip", () => {
  it("round-trips through the same webhook handler and send() path as a direct chat", async () => {
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
    await adapter.start((event) => {
      received.push(event.message);
    });

    const handler = createTelegramWebhookHandler(adapter);
    const update = {
      update_id: 2,
      message: {
        message_id: 99,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -1001234567890, type: "supergroup", title: "Team Chat" },
        from: { id: 888, is_bot: false, first_name: "Grace" },
        text: "hello team",
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
    const inbound = received[0];
    if (!inbound) {
      throw new Error("expected an inbound message");
    }
    expect(inbound.conversation.type).toBe("group");
    expect(inbound.conversation.providerConversationId).toBe("-1001234567890");
    expect(inbound.conversation.providerConversationId).not.toBe("555"); // distinct from direct-chat.spec.ts's chat

    await adapter.send({
      conversation: inbound.conversation,
      text: "hello, team!",
      replyToMessageId: inbound.id,
    });

    const sendCall = transport.calls.find((call) => call.method === "sendMessage");
    expect(sendCall?.payload.chat_id).toBe(-1001234567890);

    await adapter.stop();
  });
});
