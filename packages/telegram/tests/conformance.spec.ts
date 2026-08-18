import type { AccountAdapter, Attachment, Conversation } from "@chatter/core";
import { runAccountConformanceSuite } from "@chatter/testing";
import { TelegramAccountAdapter } from "../src/adapter/telegram-account-adapter.js";
import { mapConversation } from "../src/mapping/conversation.js";
import { createTelegramWebhookHandler } from "../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport, UNKNOWN_CHAT_ID } from "./support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";
const KNOWN_CHAT_ID = 555;

runAccountConformanceSuite({
  createAdapter: (): AccountAdapter => {
    const transport = new StubTelegramTransport();
    return new TelegramAccountAdapter(
      {
        botToken: "test-token",
        webhookSecret: WEBHOOK_SECRET,
        webhookUrl: "https://example.com/telegram-webhook",
      },
      { api: transport.api },
    );
  },

  getKnownConversation: async (adapter): Promise<Conversation> => {
    const telegramAdapter = adapter as TelegramAccountAdapter;
    const handler = createTelegramWebhookHandler(telegramAdapter);
    const chat = { id: KNOWN_CHAT_ID, type: "private" as const, first_name: "Conformance" };

    // Exercise the real inbound path (secret validation + parsing + mapping), same as a
    // genuine webhook delivery would — not a test-only bypass of production code.
    const response = await handler(
      new Request("https://example.com/telegram-webhook", {
        method: "POST",
        headers: {
          "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          update_id: 100,
          message: {
            message_id: 1,
            date: Math.floor(Date.now() / 1000),
            chat,
            from: { id: 42, is_bot: false, first_name: "Conformance" },
            text: "seed message",
          },
        }),
      }),
    );
    if (response.status !== 200) {
      throw new Error(
        `expected the seed webhook delivery to succeed, got ${String(response.status)}`,
      );
    }

    const botUserId = telegramAdapter.botUserId;
    if (botUserId === undefined) {
      throw new Error("expected adapter.start() to have populated botUserId");
    }
    return mapConversation(chat, botUserId);
  },

  getUnknownConversation: (): Conversation => ({
    provider: "telegram",
    providerAccountId: "987654321",
    providerConversationId: String(UNKNOWN_CHAT_ID),
    type: "direct",
  }),

  // This adapter doesn't declare "attachments" yet (that's the next ticket) — the suite's
  // supported-attachment check is a no-op here; only the unsupported-rejection check runs.
  getTestAttachment: (): Attachment => ({
    kind: "file",
    source: { data: Buffer.from("conformance attachment") },
  }),
});
