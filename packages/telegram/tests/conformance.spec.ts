import type { AccountAdapter, Attachment, Conversation } from "@chatter/core";
import { runAccountConformanceSuite } from "@chatter/testing";
import { TelegramAccountAdapter } from "../src/adapter/telegram-account-adapter.js";
import { mapConversation } from "../src/mapping/conversation.js";
import { createTelegramWebhookHandler } from "../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport, UNKNOWN_CHAT_ID } from "./support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";
const KNOWN_CHAT_ID = 555;
/** Matches StubTelegramTransport's default getMe() response. */
const BOT_USERNAME = "chatter_test_bot";

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

  // This adapter now declares "attachments" (specs/005-telegram-attachment-mapping) — the
  // suite's supported-attachment check genuinely exercises send() against the stubbed
  // transport, not a no-op.
  getTestAttachment: (): Attachment => ({
    kind: "file",
    source: { data: Buffer.from("conformance attachment") },
  }),

  // Required because this adapter declares "mentions" (specs/006-mentions). Drives the real
  // webhook path — secret validation, parsing, entity mapping — rather than calling the
  // mapper directly, so what the suite verifies is what a genuine delivery produces.
  //
  // One update covers every branch the contract requires: an @handle of the bot itself
  // (unresolved + isSelf), an @handle of someone else (unresolved + not self), and a
  // text_mention carrying a real user object (resolved + not self).
  emitInbound: async (adapter, scenario): Promise<void> => {
    const handler = createTelegramWebhookHandler(adapter as TelegramAccountAdapter);
    if (scenario === "edit") {
      await emitEdit(handler);
      return;
    }
    const text = `@${BOT_USERNAME} hi @alice and Bob Smith`;

    const response = await handler(
      new Request("https://example.com/telegram-webhook", {
        method: "POST",
        headers: {
          "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          update_id: 200,
          message: {
            message_id: 2,
            date: Math.floor(Date.now() / 1000),
            chat: { id: KNOWN_CHAT_ID, type: "supergroup", title: "Conformance" },
            from: { id: 42, is_bot: false, first_name: "Conformance" },
            text,
            entities: [
              { type: "mention", offset: 0, length: BOT_USERNAME.length + 1 },
              { type: "mention", offset: text.indexOf("@alice"), length: 6 },
              {
                type: "text_mention",
                offset: text.indexOf("Bob Smith"),
                length: 9,
                user: { id: 4242, is_bot: false, first_name: "Bob", last_name: "Smith" },
              },
            ],
          },
        }),
      }),
    );
    if (response.status !== 200) {
      throw new Error(
        `expected the mention webhook delivery to succeed, got ${String(response.status)}`,
      );
    }
  },
});

/**
 * Drives the adapter's real webhook path to produce a create followed by an edit of the
 * same message — the "edit" scenario the shared suite requires of any adapter declaring
 * "editNotifications". Two separate updates with distinct update_ids, exactly as Telegram
 * delivers them.
 */
async function emitEdit(handler: (request: Request) => Promise<Response>): Promise<void> {
  const sentAt = Math.floor(Date.now() / 1000);
  const base = {
    message_id: 7,
    date: sentAt,
    chat: { id: KNOWN_CHAT_ID, type: "supergroup", title: "Conformance" },
    from: { id: 42, is_bot: false, first_name: "Conformance" },
  };
  const post = async (updateId: number, key: "message" | "edited_message", message: unknown) => {
    const response = await handler(
      new Request("https://example.com/telegram-webhook", {
        method: "POST",
        headers: {
          "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET,
          "content-type": "application/json",
        },
        body: JSON.stringify({ update_id: updateId, [key]: message }),
      }),
    );
    if (response.status !== 200) {
      throw new Error(
        `expected the ${key} delivery to succeed, got ${String(response.status)}`,
      );
    }
  };

  await post(300, "message", { ...base, text: "before" });
  await post(301, "edited_message", {
    ...base,
    text: "after",
    edit_date: sentAt + 60,
  });
}
