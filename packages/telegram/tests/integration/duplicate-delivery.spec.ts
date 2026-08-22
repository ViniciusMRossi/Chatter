import type { InboundEvent, InboundMessage } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";

function buildUpdate(updateId: number, messageId: number, text: string) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 555, type: "private", first_name: "Ada" },
      from: { id: 777, is_bot: false, first_name: "Ada" },
      text,
    },
  };
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
  const events: InboundEvent[] = [];
  await adapter.start((event) => {
    events.push(event);
    received.push(event.message);
  });
  const handler = createTelegramWebhookHandler(adapter);
  return { adapter, handler, received, events };
}

describe("duplicate webhook delivery", () => {
  it("dispatches exactly one message for a redelivered update_id", async () => {
    const { adapter, handler, received } = await setUp();
    const update = buildUpdate(1001, 1, "hello");

    const first = await postUpdate(handler, update);
    const second = await postUpdate(handler, update);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(received).toHaveLength(1);

    await adapter.stop();
  });

  it("still dispatches a genuinely new update after several prior distinct updates", async () => {
    const { adapter, handler, received } = await setUp();

    for (let i = 0; i < 5; i++) {
      await postUpdate(handler, buildUpdate(2000 + i, 100 + i, `msg ${String(i)}`));
    }
    const freshResponse = await postUpdate(handler, buildUpdate(9999, 200, "fresh"));

    expect(freshResponse.status).toBe(200);
    expect(received).toHaveLength(6);

    await adapter.stop();
  });

  it("dispatches exactly one edit for a redelivered edited_message update_id", async () => {
    const { adapter, handler, events } = await setUp();
    const sentAt = Math.floor(Date.now() / 1000);
    const editUpdate = {
      update_id: 3001,
      edited_message: {
        message_id: 42,
        date: sentAt,
        edit_date: sentAt + 30,
        chat: { id: 555, type: "private", first_name: "Ada" },
        from: { id: 777, is_bot: false, first_name: "Ada" },
        text: "corrected",
      },
    };

    const first = await postUpdate(handler, editUpdate);
    const second = await postUpdate(handler, editUpdate);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Worth pinning even though it already worked before edits existed: dedup is keyed on
    // update_id and runs BEFORE any update-type branching, so this holds by an ordering
    // accident. A refactor moving the dedup check inside the message branch would produce a
    // spurious second edit with nothing else failing.
    expect(events.filter((event) => event.kind === "message.edited")).toHaveLength(1);

    await adapter.stop();
  });
});
