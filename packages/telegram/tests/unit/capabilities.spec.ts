import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

describe("Telegram adapter capabilities", () => {
  it("declares text, reply, attachments, and mentions, but not thread", () => {
    const transport = new StubTelegramTransport();
    const adapter = new TelegramAccountAdapter(
      {
        botToken: "test-token",
        webhookSecret: "s3cr3t",
        webhookUrl: "https://example.com/telegram-webhook",
      },
      { api: transport.api },
    );

    const capabilities = adapter.getCapabilities();

    expect(capabilities.has("text")).toBe(true);
    expect(capabilities.has("reply")).toBe(true);
    expect(capabilities.has("attachments")).toBe(true);
    expect(capabilities.has("mentions")).toBe(true);
    expect(capabilities.has("thread")).toBe(false);
    expect(capabilities.size).toBe(4);
  });
});
