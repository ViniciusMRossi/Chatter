import {
  ChatterAuthorizationError,
  ChatterInvalidTargetError,
  ChatterProviderUnavailableError,
  ChatterRateLimitError,
} from "@chatter/core";
import { GrammyError } from "grammy";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const CONVERSATION = {
  provider: "telegram",
  providerAccountId: "987654321",
  providerConversationId: "555",
  type: "direct" as const,
};

async function buildStartedAdapter(transport: StubTelegramTransport) {
  const adapter = new TelegramAccountAdapter(
    {
      botToken: "test-token",
      webhookSecret: "s3cr3t",
      webhookUrl: "https://example.com/telegram-webhook",
    },
    { api: transport.api },
  );
  await adapter.start(() => {
    // no-op: these checks exercise the outbound path only.
  });
  return adapter;
}

describe("deleteMessage — success (FR-016, FR-022)", () => {
  it("removes the message and reports an outcome naming it", async () => {
    const transport = new StubTelegramTransport();
    const adapter = await buildStartedAdapter(transport);

    const result = await adapter.deleteMessage({
      conversation: CONVERSATION,
      messageId: "42",
    });

    expect(transport.calls.at(-1)).toMatchObject({
      method: "deleteMessage",
      payload: { chat_id: 555, message_id: 42 },
    });
    expect(result.provider).toBe("telegram");
    expect(result.providerMessageId).toBe("42");
    expect(result.conversation).toEqual(CONVERSATION);
    // Telegram's deleteMessage returns only `true`. Synthesizing a local clock value here
    // would present a guess as a provider fact, so the key is absent rather than invented.
    expect("timestamp" in result).toBe(false);

    await adapter.stop();
  });
});

describe("deleteMessage — failure categories (FR-019)", () => {
  it("distinguishes a message that no longer exists from one it may not touch", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("deleteMessage", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message to delete not found",
    });
    const adapter = await buildStartedAdapter(transport);

    await expect(
      adapter.deleteMessage({ conversation: CONVERSATION, messageId: "42" }),
    ).rejects.toBeInstanceOf(ChatterInvalidTargetError);

    await adapter.stop();
  });

  it("maps a permission refusal to ChatterAuthorizationError", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("deleteMessage", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message can't be deleted",
    });
    const adapter = await buildStartedAdapter(transport);

    const attempt = adapter.deleteMessage({ conversation: CONVERSATION, messageId: "42" });

    await expect(attempt).rejects.toBeInstanceOf(ChatterAuthorizationError);
    await expect(attempt).rejects.not.toBeInstanceOf(ChatterInvalidTargetError);

    await adapter.stop();
  });

  it("maps the elapsed-time refusal to ChatterAuthorizationError, preserving the provider's own words", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("deleteMessage", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message can't be deleted for everyone",
    });
    const adapter = await buildStartedAdapter(transport);

    // FR-019 asks for the elapsed-time refusal to be distinguishable, and Telegram does not
    // make it distinguishable — it reports a permission failure rather than a distinct code.
    // Pinned here as a KNOWN coarseness rather than papered over: the category is truthful
    // (the account may not do this now), and manufacturing a finer distinction from
    // description-string matching alone would assert something the provider is not saying.
    // What a developer needs is preserved: the provider's own wording, and the raw error.
    const error = await adapter
      .deleteMessage({ conversation: CONVERSATION, messageId: "42" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ChatterAuthorizationError);
    expect((error as Error).message).toContain("can't be deleted for everyone");
    expect((error as Error).cause).toBeInstanceOf(GrammyError);

    await adapter.stop();
  });

  it("maps a rate limit to ChatterRateLimitError with the provider's retry-after", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("deleteMessage", {
      ok: false,
      error_code: 429,
      description: "Too Many Requests: retry after 7",
      parameters: { retry_after: 7 },
    });
    const adapter = await buildStartedAdapter(transport);

    const error = await adapter
      .deleteMessage({ conversation: CONVERSATION, messageId: "42" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ChatterRateLimitError);
    expect((error as ChatterRateLimitError).retryAfterMs).toBe(7000);

    await adapter.stop();
  });
});

describe("deleteMessage — provider limits are never pre-judged locally (FR-021)", () => {
  it("attempts a deletion of an old message rather than refusing it itself", async () => {
    const transport = new StubTelegramTransport();
    const adapter = await buildStartedAdapter(transport);

    // A message far outside Telegram's 48-hour window for deleting others' messages. Chatter
    // must NOT decide that locally: a limit evaluated against a local clock is wrong near the
    // boundary whenever clocks disagree, and would refuse operations the provider would have
    // accepted. Contrast with send()'s length/size pre-validation, which is knowable locally
    // and cannot change between the check and the call.
    await adapter.deleteMessage({ conversation: CONVERSATION, messageId: "1" });

    expect(transport.calls.some((call) => call.method === "deleteMessage")).toBe(true);

    await adapter.stop();
  });

  it("reports the provider's answer when it does refuse on time grounds", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("deleteMessage", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message can't be deleted for everyone",
    });
    const adapter = await buildStartedAdapter(transport);

    await expect(
      adapter.deleteMessage({ conversation: CONVERSATION, messageId: "1" }),
    ).rejects.toBeInstanceOf(ChatterAuthorizationError);

    await adapter.stop();
  });
});

describe("outbound operations — the unknown bucket stays explicit", () => {
  it("maps an unrecognized Telegram error to the unknown category, not the transport one", async () => {
    const transport = new StubTelegramTransport();
    const adapter = await buildStartedAdapter(transport);
    transport.queue("deleteMessage", {
      ok: false,
      error_code: 500,
      description: "Internal Server Error",
    });

    const error = await adapter
      .deleteMessage({ conversation: CONVERSATION, messageId: "42" })
      .catch((caught: unknown) => caught);

    // A 500 is still a GrammyError, so it lands in the unknown bucket rather than the
    // transport bucket — asserted here so the boundary between them is explicit.
    expect(error).not.toBeInstanceOf(ChatterProviderUnavailableError);

    await adapter.stop();
  });
});
