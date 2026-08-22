import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

describe("Telegram adapter capabilities", () => {
  it("declares text, reply, attachments, mentions and editNotifications, but not thread", () => {
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
    expect(capabilities.has("editNotifications")).toBe(true);
    expect(capabilities.has("thread")).toBe(false);
    // Not yet declared — the outbound operations are a later increment, and declaring a
    // capability before implementing it is exactly what the capability model exists to
    // prevent.
    expect(capabilities.has("editMessage")).toBe(false);
    expect(capabilities.has("deleteMessage")).toBe(false);
    expect(capabilities.size).toBe(5);
  });
});
