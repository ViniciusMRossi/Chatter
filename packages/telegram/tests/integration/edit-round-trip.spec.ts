import type { InboundEvent } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";
const CHAT = { id: 555, type: "private", first_name: "Ada" } as const;
const FROM = { id: 777, is_bot: false, first_name: "Ada" } as const;
const SENT_AT = 1_700_000_000;

/** Reads a dispatched event by index, failing with a useful message rather than `!`. */
function at(events: InboundEvent[], index: number): InboundEvent {
  const event = events[index];
  if (event === undefined) {
    throw new Error(
      `expected an inbound event at index ${String(index)}, got ${String(events.length)} event(s)`,
    );
  }
  return event;
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
  const events: InboundEvent[] = [];
  const createdOnly: InboundEvent[] = [];
  await adapter.start((event) => {
    events.push(event);
    // Stands in for an application written before edits existed: it only ever looked at
    // newly-created messages. Nothing this feature adds may reach it.
    if (event.kind === "message.created") {
      createdOnly.push(event);
    }
  });
  return { adapter, handler: createTelegramWebhookHandler(adapter), events, createdOnly };
}

describe("inbound edit round trip — dispatch shape (US1)", () => {
  it("dispatches an edit as its own event, not as another created message", async () => {
    const { adapter, handler, events, createdOnly } = await setUp();

    await postUpdate(handler, {
      update_id: 1,
      message: { message_id: 10, date: SENT_AT, chat: CHAT, from: FROM, text: "before" },
    });
    await postUpdate(handler, {
      update_id: 2,
      edited_message: {
        message_id: 10,
        date: SENT_AT,
        edit_date: SENT_AT + 120,
        chat: CHAT,
        from: FROM,
        text: "after",
      },
    });

    expect(events.map((event) => event.kind)).toEqual(["message.created", "message.edited"]);
    expect(events[1]?.message.text).toBe("after");

    // The assertion that actually matters: an application that only ever handled created
    // messages sees exactly one, not two. Routing edits through "message.created" would make
    // every such application double-handle with nothing to tell the cases apart.
    expect(createdOnly).toHaveLength(1);
    expect(createdOnly[0]?.message.text).toBe("before");

    await adapter.stop();
  });

  it("reuses the original message id so an application can correlate without matching text", async () => {
    const { adapter, handler, events } = await setUp();

    await postUpdate(handler, {
      update_id: 1,
      message: { message_id: 99, date: SENT_AT, chat: CHAT, from: FROM, text: "before" },
    });
    await postUpdate(handler, {
      update_id: 2,
      edited_message: {
        message_id: 99,
        date: SENT_AT,
        edit_date: SENT_AT + 5,
        chat: CHAT,
        from: FROM,
        text: "after",
      },
    });

    expect(events[1]?.message.id).toBe(events[0]?.message.id);
    expect(events[1]?.message.id).toBe("99");

    await adapter.stop();
  });

  it("dispatches an edit for a message it never delivered, without requiring prior state", async () => {
    const { adapter, handler, events } = await setUp();

    // No preceding "message" update — e.g. the application started after it was sent.
    await postUpdate(handler, {
      update_id: 1,
      edited_message: {
        message_id: 4242,
        date: SENT_AT,
        edit_date: SENT_AT + 900,
        chat: CHAT,
        from: FROM,
        text: "edited out of nowhere",
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("message.edited");
    expect(events[0]?.message.text).toBe("edited out of nowhere");

    await adapter.stop();
  });
});

describe("inbound edit round trip — timestamps (US1)", () => {
  it("keeps createdAt as the original send time and reports editedAt separately", async () => {
    const { adapter, handler, events } = await setUp();

    await postUpdate(handler, {
      update_id: 1,
      message: { message_id: 10, date: SENT_AT, chat: CHAT, from: FROM, text: "before" },
    });
    await postUpdate(handler, {
      update_id: 2,
      edited_message: {
        message_id: 10,
        date: SENT_AT,
        edit_date: SENT_AT + 300,
        chat: CHAT,
        from: FROM,
        text: "after",
      },
    });

    const created = at(events, 0).message;
    const edited = at(events, 1).message;

    expect(created.createdAt).toEqual(new Date(SENT_AT * 1000));
    // An edit reports a change of content, never a change of when it was sent.
    expect(edited.createdAt).toEqual(created.createdAt);
    expect(edited.editedAt).toEqual(new Date((SENT_AT + 300) * 1000));

    await adapter.stop();
  });

  it("omits the editedAt key entirely on a message that has never been edited", async () => {
    const { adapter, handler, events } = await setUp();

    await postUpdate(handler, {
      update_id: 1,
      message: { message_id: 10, date: SENT_AT, chat: CHAT, from: FROM, text: "plain" },
    });

    // Deliberately `in`, not `=== undefined`. A present-but-undefined key would change the
    // message's shape for every application that predates this feature — serializing it,
    // diffing it, or enumerating its keys would all differ.
    expect("editedAt" in at(events, 0).message).toBe(false);

    await adapter.stop();
  });
});

describe("inbound edit round trip — mentions follow edited content (US1)", () => {
  it("reports the mentions present in the edited text, not the original", async () => {
    const { adapter, handler, events } = await setUp();

    await postUpdate(handler, {
      update_id: 1,
      message: {
        message_id: 10,
        date: SENT_AT,
        chat: CHAT,
        from: FROM,
        text: "hi @alice",
        entities: [{ type: "mention", offset: 3, length: 6 }],
      },
    });
    await postUpdate(handler, {
      update_id: 2,
      edited_message: {
        message_id: 10,
        date: SENT_AT,
        edit_date: SENT_AT + 10,
        chat: CHAT,
        from: FROM,
        text: "hi @bob",
        entities: [{ type: "mention", offset: 3, length: 4 }],
      },
    });

    expect(events[0]?.message.mentions?.map((m) => m.text)).toEqual(["@alice"]);
    expect(events[1]?.message.mentions?.map((m) => m.text)).toEqual(["@bob"]);

    await adapter.stop();
  });

  it("carries no mentions key at all when an edit removed the only mention", async () => {
    const { adapter, handler, events } = await setUp();

    await postUpdate(handler, {
      update_id: 1,
      message: {
        message_id: 10,
        date: SENT_AT,
        chat: CHAT,
        from: FROM,
        text: "hi @alice",
        entities: [{ type: "mention", offset: 3, length: 6 }],
      },
    });
    await postUpdate(handler, {
      update_id: 2,
      edited_message: {
        message_id: 10,
        date: SENT_AT,
        edit_date: SENT_AT + 10,
        chat: CHAT,
        from: FROM,
        text: "hi nobody",
      },
    });

    expect("mentions" in at(events, 1).message).toBe(false);

    await adapter.stop();
  });

  it("positions mentions in edited text by UTF-16 code units, emoji included", async () => {
    const { adapter, handler, events } = await setUp();
    // "👋" is a surrogate pair: two UTF-16 code units, one code point. Telegram offsets are
    // code units, which is exactly what JS string indexing uses. A mapper "fixed" to use
    // [...text] would index by code point and place this mention one unit early — passing
    // every ASCII test and silently wrong in real conversations.
    const text = "👋 @alice";

    await postUpdate(handler, {
      update_id: 1,
      edited_message: {
        message_id: 10,
        date: SENT_AT,
        edit_date: SENT_AT + 10,
        chat: CHAT,
        from: FROM,
        text,
        entities: [{ type: "mention", offset: 3, length: 6 }],
      },
    });

    const mentions = at(events, 0).message.mentions ?? [];
    const mention = mentions[0];
    if (mention === undefined) {
      throw new Error("expected the edited message to carry a mention");
    }
    expect(mention.offset).toBe(3);
    expect(mention.text).toBe("@alice");
    expect(text.slice(mention.offset, mention.offset + mention.length)).toBe(mention.text);

    await adapter.stop();
  });

  it("reads caption_entities for an edited attachment caption", async () => {
    const { adapter, handler, events } = await setUp();

    await postUpdate(handler, {
      update_id: 1,
      edited_message: {
        message_id: 10,
        date: SENT_AT,
        edit_date: SENT_AT + 10,
        chat: CHAT,
        from: FROM,
        // Deliberately different lengths: reading the wrong entity array would yield offsets
        // against a string the message does not expose, which throws nothing and looks fine
        // whenever the two strings happen to resemble each other.
        text: "a much longer text field that is not the caption",
        entities: [{ type: "mention", offset: 2, length: 5 }],
        caption: "look @bob",
        caption_entities: [{ type: "mention", offset: 5, length: 4 }],
        photo: [{ file_id: "photo-1", file_unique_id: "u1", width: 1, height: 1 }],
      },
    });

    const message = at(events, 0).message;
    expect(message.text).toBe("look @bob");
    expect(message.mentions?.map((m) => m.text)).toEqual(["@bob"]);

    await adapter.stop();
  });
});
