import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

describe("Telegram adapter capabilities", () => {
  it("declares text, reply, attachments, mentions, and all three edit/delete capabilities, but not thread", () => {
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
    expect(capabilities.has("editMessage")).toBe(true);
    expect(capabilities.has("deleteMessage")).toBe(true);
    expect(capabilities.has("thread")).toBe(false);
    expect(capabilities.size).toBe(7);
  });

  it("claims no capability for reporting deletions, because Telegram reports none (FR-012)", () => {
    const transport = new StubTelegramTransport();
    const adapter = new TelegramAccountAdapter(
      {
        botToken: "test-token",
        webhookSecret: "s3cr3t",
        webhookUrl: "https://example.com/telegram-webhook",
      },
      { api: transport.api },
    );

    // Being able to DELETE a message and being told when someone else deletes one are
    // different things. Telegram offers the first and not the second, and the capability set
    // must say so rather than implying symmetry.
    expect([...adapter.getCapabilities()]).not.toContain("deleteNotifications");
  });
});
