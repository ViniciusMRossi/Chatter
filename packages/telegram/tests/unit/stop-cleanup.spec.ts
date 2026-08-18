import { describe, expect, it, vi } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const BOT_TOKEN = "123456789:AAExampleBotTokenValueForTesting";
const WEBHOOK_SECRET = "my-super-secret-webhook-token";

describe("stop() cleanup failure handling", () => {
  it("still resolves without throwing, and calls onNonFatalError, when deleteWebhook fails", async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("deleteWebhook", {
      ok: false,
      error_code: 500,
      description: "Internal Server Error",
    });
    const onNonFatalError = vi.fn();
    const adapter = new TelegramAccountAdapter(
      {
        botToken: BOT_TOKEN,
        webhookSecret: WEBHOOK_SECRET,
        webhookUrl: "https://example.com/telegram-webhook",
      },
      { api: transport.api, onNonFatalError },
    );
    await adapter.start(() => {
      // unused in this test
    });

    await expect(adapter.stop()).resolves.toBeUndefined();
    expect(onNonFatalError).toHaveBeenCalledTimes(1);
  });

  it("never includes the bot token or webhook secret in the surfaced message", async () => {
    const transport = new StubTelegramTransport();
    transport.queueError("deleteWebhook", {
      ok: false,
      error_code: 500,
      description: "Internal Server Error",
    });
    const onNonFatalError = vi.fn();
    const adapter = new TelegramAccountAdapter(
      {
        botToken: BOT_TOKEN,
        webhookSecret: WEBHOOK_SECRET,
        webhookUrl: "https://example.com/telegram-webhook",
      },
      { api: transport.api, onNonFatalError },
    );
    await adapter.start(() => {
      // unused in this test
    });

    await adapter.stop();

    expect(onNonFatalError).toHaveBeenCalledTimes(1);
    const [message] = onNonFatalError.mock.calls[0] as [string];
    expect(message).not.toContain(BOT_TOKEN);
    expect(message).not.toContain(WEBHOOK_SECRET);
  });
});
