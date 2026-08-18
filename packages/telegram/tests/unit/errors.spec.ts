import {
  ChatterAuthenticationError,
  ChatterInvalidTargetError,
  ChatterRateLimitError,
} from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const DIRECT_CONVERSATION = {
  provider: "telegram",
  providerAccountId: "987654321",
  providerConversationId: "555",
  type: "direct" as const,
};

function buildAdapter(transport: StubTelegramTransport): TelegramAccountAdapter {
  return new TelegramAccountAdapter(
    {
      botToken: "test-token",
      webhookSecret: "s3cr3t",
      webhookUrl: "https://example.com/telegram-webhook",
    },
    { api: transport.api },
  );
}

describe("Telegram error mapping", () => {
  it("maps a 401 Unauthorized response to ChatterAuthenticationError", async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("sendMessage", {
      ok: false,
      error_code: 401,
      description: "Unauthorized",
    });
    const adapter = buildAdapter(transport);

    await expect(
      adapter.send({ conversation: DIRECT_CONVERSATION, text: "hello" }),
    ).rejects.toBeInstanceOf(ChatterAuthenticationError);
  });

  it('maps "chat not found" (400) to ChatterInvalidTargetError', async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("sendMessage", {
      ok: false,
      error_code: 400,
      description: "Bad Request: chat not found",
    });
    const adapter = buildAdapter(transport);

    await expect(
      adapter.send({ conversation: DIRECT_CONVERSATION, text: "hello" }),
    ).rejects.toBeInstanceOf(ChatterInvalidTargetError);
  });

  it('maps "bot was blocked by the user" (403) to ChatterInvalidTargetError', async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("sendMessage", {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    });
    const adapter = buildAdapter(transport);

    await expect(
      adapter.send({ conversation: DIRECT_CONVERSATION, text: "hello" }),
    ).rejects.toBeInstanceOf(ChatterInvalidTargetError);
  });

  it("maps a 429 flood-control response to ChatterRateLimitError with retryAfterMs", async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("sendMessage", {
      ok: false,
      error_code: 429,
      description: "Too Many Requests: retry later",
      parameters: { retry_after: 5 },
    });
    const adapter = buildAdapter(transport);

    const failure = adapter.send({ conversation: DIRECT_CONVERSATION, text: "hello" });
    await expect(failure).rejects.toBeInstanceOf(ChatterRateLimitError);
    await expect(failure.catch((error: unknown) => error)).resolves.toMatchObject({
      retryable: true,
      retryAfterMs: 5000,
    });
  });

  it("surfaces the new chat ID when Telegram signals a group->supergroup migration", async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("sendMessage", {
      ok: false,
      error_code: 400,
      description: "Bad Request: group chat was upgraded to a supergroup chat",
      parameters: { migrate_to_chat_id: -1001234567890 },
    });
    const adapter = buildAdapter(transport);

    const failure = adapter.send({ conversation: DIRECT_CONVERSATION, text: "hello" });
    await expect(failure).rejects.toBeInstanceOf(ChatterInvalidTargetError);
    await expect(failure.catch((error: unknown) => error)).resolves.toMatchObject({
      message: expect.stringContaining("-1001234567890") as string,
    });
  });

  it("never mentions migration for a failure with no migration signal", async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("sendMessage", {
      ok: false,
      error_code: 400,
      description: "Bad Request: chat not found",
    });
    const adapter = buildAdapter(transport);

    const failure = adapter.send({ conversation: DIRECT_CONVERSATION, text: "hello" });
    await expect(failure.catch((error: unknown) => error)).resolves.toMatchObject({
      message: expect.not.stringContaining("migrat") as string,
    });
  });
});
