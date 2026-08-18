import { ChatterAuthenticationError, ChatterProviderUnavailableError } from "@chatter/core";
import { HttpError } from "grammy";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { mapTelegramError } from "../../src/errors/map-telegram-error.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const BOT_TOKEN = "123456789:AAExampleBotTokenValueForTesting";
const WEBHOOK_SECRET = "my-super-secret-webhook-token";

function serializeErrorChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message, current.stack ?? "");
    current = current.cause;
  }
  return parts.join("\n");
}

describe("secret redaction", () => {
  it("never surfaces a token-bearing request URL from an HttpError", () => {
    const httpError = new HttpError(
      `request to https://api.telegram.org/bot${BOT_TOKEN}/sendMessage failed`,
      new TypeError("fetch failed"),
    );

    const mapped = mapTelegramError(httpError);

    expect(mapped).toBeInstanceOf(ChatterProviderUnavailableError);
    expect(serializeErrorChain(mapped)).not.toContain(BOT_TOKEN);
  });

  it("never includes the configured bot token or webhook secret in an authentication failure", async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("getMe", { ok: false, error_code: 401, description: "Unauthorized" });
    const adapter = new TelegramAccountAdapter(
      {
        botToken: BOT_TOKEN,
        webhookSecret: WEBHOOK_SECRET,
        webhookUrl: "https://example.com/telegram-webhook",
      },
      { api: transport.api },
    );

    let caught: unknown;
    try {
      await adapter.start(() => {
        // unused in this test
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ChatterAuthenticationError);
    const serialized = serializeErrorChain(caught);
    expect(serialized).not.toContain(BOT_TOKEN);
    expect(serialized).not.toContain(WEBHOOK_SECRET);
  });
});
