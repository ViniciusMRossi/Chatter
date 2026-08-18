import { ChatterConfigurationError } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

const KNOWN_CONVERSATION = {
  provider: "telegram",
  providerAccountId: "987654321",
  providerConversationId: "555",
  type: "direct" as const,
};

async function makeAdapter(): Promise<{ adapter: TelegramAccountAdapter; transport: StubTelegramTransport }> {
  const transport = new StubTelegramTransport();
  const adapter = new TelegramAccountAdapter(
    { botToken: "test-token", webhookSecret: "s3cr3t", webhookUrl: "https://example.com/webhook" },
    { api: transport.api },
  );
  await adapter.start(() => {
    // no-op
  });
  return { adapter, transport };
}

describe("Telegram attachment size limits", () => {
  it("rejects a { data } image attachment one byte over the 10MB limit", async () => {
    const { adapter, transport } = await makeAdapter();

    await expect(
      adapter.send({
        conversation: KNOWN_CONVERSATION,
        attachment: { kind: "image", source: { data: Buffer.alloc(10_000_001) } },
      }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);
    expect(transport.calls.filter((c) => c.method === "sendPhoto")).toHaveLength(0);
  });

  it("accepts a { data } image attachment at exactly the 10MB limit", async () => {
    const { adapter } = await makeAdapter();

    await expect(
      adapter.send({
        conversation: KNOWN_CONVERSATION,
        attachment: { kind: "image", source: { data: Buffer.alloc(10_000_000) } },
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a { data } video attachment one byte over the 50MB limit", async () => {
    const { adapter } = await makeAdapter();

    await expect(
      adapter.send({
        conversation: KNOWN_CONVERSATION,
        attachment: { kind: "video", source: { data: Buffer.alloc(50_000_001) } },
      }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);
  });

  it("rejects a { data } document attachment one byte over the 50MB limit", async () => {
    const { adapter } = await makeAdapter();

    await expect(
      adapter.send({
        conversation: KNOWN_CONVERSATION,
        attachment: { kind: "file", source: { data: Buffer.alloc(50_000_001) } },
      }),
    ).rejects.toBeInstanceOf(ChatterConfigurationError);
  });

  it("never applies the size check to a { url }-sourced attachment", async () => {
    const { adapter } = await makeAdapter();

    await expect(
      adapter.send({
        conversation: KNOWN_CONVERSATION,
        attachment: { kind: "video", source: { url: "https://example.com/huge-video.mp4" } },
      }),
    ).resolves.toBeDefined();
  });
});
