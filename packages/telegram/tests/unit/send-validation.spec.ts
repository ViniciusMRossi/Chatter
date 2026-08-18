import { ChatterConfigurationError } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const DIRECT_CONVERSATION = {
  provider: "telegram",
  providerAccountId: "987654321",
  providerConversationId: "555",
  type: "direct" as const,
};

const TEXT_LIMIT = 4096;

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

describe("outbound message length validation", () => {
  it("rejects text over the 4096-character limit with ChatterConfigurationError, no API call made", async () => {
    const transport = new StubTelegramTransport();
    const adapter = buildAdapter(transport);
    const oversizedText = "a".repeat(TEXT_LIMIT + 1);

    await expect(
      adapter.send({ conversation: DIRECT_CONVERSATION, text: oversizedText }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);
    expect(transport.calls).toHaveLength(0);
  });

  it("accepts text at exactly the 4096-character limit", async () => {
    const transport = new StubTelegramTransport();
    const adapter = buildAdapter(transport);
    const maxLengthText = "a".repeat(TEXT_LIMIT);

    await expect(
      adapter.send({ conversation: DIRECT_CONVERSATION, text: maxLengthText }),
    ).resolves.toBeDefined();
    expect(transport.calls).toHaveLength(1);
  });
});
