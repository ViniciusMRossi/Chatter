import type { InboundMessage } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const WEBHOOK_SECRET = "s3cr3t-webhook-token";
/** Matches StubTelegramTransport's default getMe() response. */
const BOT_USERNAME = "chatter_test_bot";

async function setUp(): Promise<{
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
  await adapter.start((event) => {
    received.push(event.message);
  });
  return { handler: createTelegramWebhookHandler(adapter), received };
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

const baseMessage = {
  message_id: 10,
  date: 1_700_000_000,
  chat: { id: 555, type: "group", title: "Team" },
  from: { id: 777, is_bot: false, first_name: "Ada" },
};

describe("inbound mention round trip — plain text messages", () => {
  it("dispatches a text message's mentions end to end", async () => {
    const { handler, received } = await setUp();

    const response = await postUpdate(handler, {
      update_id: 1,
      message: {
        ...baseMessage,
        text: "hey @alice and @bob",
        entities: [
          { type: "mention", offset: 4, length: 6 },
          { type: "mention", offset: 15, length: 4 },
        ],
      },
    });

    expect(response.status).toBe(200);
    expect(received[0]?.mentions?.map((m) => m.text)).toEqual(["@alice", "@bob"]);
  });

  it("carries no mentions field at all when the message references no one", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 2,
      message: { ...baseMessage, text: "just a normal message" },
    });

    expect(received[0]?.text).toBe("just a normal message");
    expect(received[0]?.mentions).toBeUndefined();
    expect("mentions" in (received[0] ?? {})).toBe(false);
  });

  it("recognizes being addressed by handle, end to end", async () => {
    const { handler, received } = await setUp();

    const text = `@${BOT_USERNAME} status please`;
    await postUpdate(handler, {
      update_id: 3,
      message: {
        ...baseMessage,
        text,
        entities: [{ type: "mention", offset: 0, length: BOT_USERNAME.length + 1 }],
      },
    });

    expect(received[0]?.mentions?.[0]?.isSelf).toBe(true);
  });
});

describe("inbound mention round trip — captions (US3)", () => {
  it("dispatches a mention that appears in a photo caption", async () => {
    const { handler, received } = await setUp();

    const response = await postUpdate(handler, {
      update_id: 10,
      message: {
        ...baseMessage,
        photo: [{ file_id: "photo-1", file_unique_id: "photo-1-u", width: 800, height: 800 }],
        caption: "look @alice",
        caption_entities: [{ type: "mention", offset: 5, length: 6 }],
      },
    });

    expect(response.status).toBe(200);
    expect(received[0]?.attachments?.[0]?.kind).toBe("image");
    expect(received[0]?.mentions).toHaveLength(1);
    expect(received[0]?.mentions?.[0]?.text).toBe("@alice");
  });

  it("positions caption mentions against the text the message actually exposes", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 11,
      message: {
        ...baseMessage,
        photo: [{ file_id: "photo-2", file_unique_id: "photo-2-u", width: 800, height: 800 }],
        caption: "look @alice",
        caption_entities: [{ type: "mention", offset: 5, length: 6 }],
      },
    });

    const message = received[0];
    const mention = message?.mentions?.[0];
    expect(message?.text).toBeDefined();
    expect(mention).toBeDefined();
    if (message?.text === undefined || mention === undefined) return;
    // The invariant a consumer relies on: no special-casing for captioned messages.
    expect(message.text.slice(mention.offset, mention.offset + mention.length)).toBe(mention.text);
  });

  it("reads caption_entities — not entities — for a captioned attachment", async () => {
    const { handler, received } = await setUp();

    // The regression guard for research.md §5. Both arrays are present with deliberately
    // different offsets, and `text`/`caption` are different lengths, so reading the wrong
    // array yields a mention whose text disagrees with its own slice rather than something
    // superficially plausible.
    await postUpdate(handler, {
      update_id: 12,
      message: {
        ...baseMessage,
        photo: [{ file_id: "photo-3", file_unique_id: "photo-3-u", width: 800, height: 800 }],
        text: "a much longer decoy string mentioning @decoy here",
        entities: [{ type: "mention", offset: 38, length: 6 }],
        caption: "hi @real",
        caption_entities: [{ type: "mention", offset: 3, length: 5 }],
      },
    });

    const message = received[0];
    expect(message?.text).toBe("hi @real");
    expect(message?.mentions).toHaveLength(1);
    expect(message?.mentions?.[0]?.text).toBe("@real");
    expect(message?.mentions?.[0]?.offset).toBe(3);
    // And the invariant still holds, which is what would break if the arrays were swapped.
    const mention = message?.mentions?.[0];
    if (message?.text === undefined || mention === undefined) return;
    expect(message.text.slice(mention.offset, mention.offset + mention.length)).toBe(mention.text);
  });

  it("carries no mentions for a captionless attachment", async () => {
    const { handler, received } = await setUp();

    await postUpdate(handler, {
      update_id: 13,
      message: {
        ...baseMessage,
        photo: [{ file_id: "photo-4", file_unique_id: "photo-4-u", width: 800, height: 800 }],
      },
    });

    expect(received[0]?.attachments).toHaveLength(1);
    expect(received[0]?.mentions).toBeUndefined();
  });
});

describe("inbound mention round trip — resilience (FR-015)", () => {
  it("still delivers the message when an entity is malformed", async () => {
    const { handler, received } = await setUp();

    const response = await postUpdate(handler, {
      update_id: 20,
      message: {
        ...baseMessage,
        text: "hello there",
        entities: [{ type: "mention", offset: 0, length: 9999 }],
      },
    });

    expect(response.status).toBe(200);
    expect(received).toHaveLength(1);
    expect(received[0]?.text).toBe("hello there");
    expect(received[0]?.mentions).toBeUndefined();
  });
});
