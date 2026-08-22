import {
  ChatterAuthorizationError,
  ChatterConfigurationError,
  ChatterInvalidTargetError,
} from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const CONVERSATION = {
  provider: "telegram",
  providerAccountId: "987654321",
  providerConversationId: "555",
  type: "direct" as const,
};

const NO_TEXT_TO_EDIT = {
  ok: false as const,
  error_code: 400,
  description: "Bad Request: there is no text in the message to edit",
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

function editCalls(transport: StubTelegramTransport): string[] {
  return transport.calls
    .map((call) => call.method)
    .filter((method) => method === "editMessageText" || method === "editMessageCaption");
}

describe("editMessage — choosing text vs caption (FR-017)", () => {
  it("edits a text message with a single editMessageText call", async () => {
    const transport = new StubTelegramTransport();
    const adapter = await buildStartedAdapter(transport);
    // Send first, so the edit targets a message the provider actually knows — the same
    // round trip an application makes.
    const sent = await adapter.send({ conversation: CONVERSATION, text: "typo" });

    const result = await adapter.editMessage({
      conversation: CONVERSATION,
      messageId: sent.providerMessageId,
      text: "corrected",
    });

    // Asserting the SEQUENCE, not only the outcome: the common case must stay one round
    // trip, and a change that always probed the caption endpoint first would pass an
    // outcome-only assertion while doubling every edit's cost.
    expect(editCalls(transport)).toEqual(["editMessageText"]);
    expect(transport.calls.at(-1)?.payload).toMatchObject({
      chat_id: 555,
      message_id: Number(sent.providerMessageId),
      text: "corrected",
    });
    expect(result.providerMessageId).toBe(sent.providerMessageId);
    expect(result.provider).toBe("telegram");

    await adapter.stop();
  });

  it("rejects an edit to identical content end to end, without a queued canned error", async () => {
    const transport = new StubTelegramTransport();
    const adapter = await buildStartedAdapter(transport);
    const sent = await adapter.send({ conversation: CONVERSATION, text: "unchanged" });

    // No queued response: the stub answers the way Telegram really does, so this exercises
    // the whole path rather than a canned error handed to the mapper.
    await expect(
      adapter.editMessage({
        conversation: CONVERSATION,
        messageId: sent.providerMessageId,
        text: "unchanged",
      }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);

    await adapter.stop();
  });

  it("falls back to editMessageCaption when the message has no text to edit", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("editMessageText", NO_TEXT_TO_EDIT);
    const adapter = await buildStartedAdapter(transport);

    const result = await adapter.editMessage({
      conversation: CONVERSATION,
      messageId: "42",
      text: "new caption",
    });

    // The provider is the only available source of truth about which field the message
    // has: Chatter keeps no record of what it sent, and Telegram gives bots no way to fetch
    // a message by id. Two round trips is the accepted price of not assuming (research D6).
    expect(editCalls(transport)).toEqual(["editMessageText", "editMessageCaption"]);
    expect(transport.calls.at(-1)?.payload).toMatchObject({
      chat_id: 555,
      message_id: 42,
      caption: "new caption",
    });
    expect(result.providerMessageId).toBe("42");

    await adapter.stop();
  });

  it("surfaces the fallback's error, not the first call's, when the caption edit also fails", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("editMessageText", NO_TEXT_TO_EDIT);
    transport.queue("editMessageCaption", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message to edit not found",
    });
    const adapter = await buildStartedAdapter(transport);

    // The second call is the one that made the real attempt against the field the message
    // actually has. Reporting the first call's "no text to edit" would describe a probe, not
    // the failure.
    await expect(
      adapter.editMessage({ conversation: CONVERSATION, messageId: "42", text: "nope" }),
    ).rejects.toBeInstanceOf(ChatterInvalidTargetError);

    await adapter.stop();
  });

  it("does not fall back when the text edit fails for an unrelated reason", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("editMessageText", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message to edit not found",
    });
    const adapter = await buildStartedAdapter(transport);

    await expect(
      adapter.editMessage({ conversation: CONVERSATION, messageId: "42", text: "nope" }),
    ).rejects.toBeInstanceOf(ChatterInvalidTargetError);
    // A blanket retry-on-any-failure would turn every failed edit into two requests and
    // could report a caption error for a text message.
    expect(editCalls(transport)).toEqual(["editMessageText"]);

    await adapter.stop();
  });
});

describe("editMessage — failure categories (FR-019, FR-020)", () => {
  it("rejects an edit to identical content as ChatterConfigurationError, never as success", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("editMessageText", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message is not modified",
    });
    const adapter = await buildStartedAdapter(transport);

    const attempt = adapter.editMessage({
      conversation: CONVERSATION,
      messageId: "42",
      text: "same",
    });

    // Reporting success would present a request the provider refused as having been carried
    // out, and would conceal an application whose edit "succeeds" every time because it keeps
    // recomputing the same content.
    await expect(attempt).rejects.toBeInstanceOf(ChatterConfigurationError);
    // Assert what it must NOT be as well — misattribution is the actual failure mode here,
    // and both of these would send a developer hunting a defect that is not there.
    await expect(attempt).rejects.not.toBeInstanceOf(ChatterInvalidTargetError);
    await expect(attempt).rejects.not.toBeInstanceOf(ChatterAuthorizationError);
    // It must also not be mistaken for the caption case.
    expect(editCalls(transport)).toEqual(["editMessageText"]);

    await adapter.stop();
  });

  it("maps a message that cannot be reached to ChatterInvalidTargetError", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("editMessageText", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message to edit not found",
    });
    const adapter = await buildStartedAdapter(transport);

    await expect(
      adapter.editMessage({ conversation: CONVERSATION, messageId: "42", text: "x" }),
    ).rejects.toBeInstanceOf(ChatterInvalidTargetError);

    await adapter.stop();
  });

  it("maps a refusal to edit someone else's message to ChatterAuthorizationError", async () => {
    const transport = new StubTelegramTransport();
    transport.queue("editMessageText", {
      ok: false,
      error_code: 400,
      description: "Bad Request: message can't be edited",
    });
    const adapter = await buildStartedAdapter(transport);

    await expect(
      adapter.editMessage({ conversation: CONVERSATION, messageId: "42", text: "x" }),
    ).rejects.toBeInstanceOf(ChatterAuthorizationError);

    await adapter.stop();
  });
});
