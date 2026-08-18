import { ChatterConfigurationError, ChatterRateLimitError, ChatterUnsupportedCapabilityError } from "@chatter/core";
import { describe, expect, it } from "vitest";
import { FakeAccountAdapter } from "../src/index.js";

describe("FakeAccountAdapter", () => {
  it("declares the default capability set", () => {
    const adapter = new FakeAccountAdapter();
    const capabilities = adapter.getCapabilities();

    expect(capabilities.has("text")).toBe(true);
    expect(capabilities.has("reply")).toBe(true);
    expect(capabilities.has("thread")).toBe(true);
  });

  it("simulateRateLimit() makes only the next send() reject with ChatterRateLimitError", async () => {
    const adapter = new FakeAccountAdapter();
    const conversation = {
      provider: "fake",
      providerAccountId: "acct-1",
      providerConversationId: "dm-1",
      type: "direct" as const,
    };
    adapter.emitInbound({
      id: "msg-1",
      provider: "fake",
      sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
      conversation,
      text: "hi",
      createdAt: new Date(),
    });

    adapter.simulateRateLimit(2000);

    const failure = adapter.send({ conversation, text: "hello" });
    await expect(failure).rejects.toBeInstanceOf(ChatterRateLimitError);
    await expect(failure.catch((error: unknown) => error)).resolves.toMatchObject({
      retryable: true,
      retryAfterMs: 2000,
    });

    // The rate limit only applies to the one send() call it was armed for.
    await expect(adapter.send({ conversation, text: "hello again" })).resolves.toBeDefined();
  });

  describe("attachments", () => {
    const conversation = {
      provider: "fake",
      providerAccountId: "acct-1",
      providerConversationId: "dm-1",
      type: "direct" as const,
    };

    function makeAdapterWithKnownConversation(
      config?: ConstructorParameters<typeof FakeAccountAdapter>[0],
    ): FakeAccountAdapter {
      const adapter = new FakeAccountAdapter(config);
      adapter.emitInbound({
        id: "msg-1",
        provider: "fake",
        sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
        conversation,
        text: "hi",
        createdAt: new Date(),
      });
      return adapter;
    }

    it("send() with a { url }-sourced attachment succeeds when 'attachments' is declared", async () => {
      const adapter = makeAdapterWithKnownConversation({ capabilities: ["text", "attachments"] });

      const result = await adapter.send({
        conversation,
        attachment: { kind: "image", source: { url: "https://example.com/cat.png" } },
      });

      expect(result.providerMessageId).toBeTruthy();
      expect(result.conversation.providerConversationId).toBe("dm-1");
    });

    it("send() with a { data: Buffer }-sourced attachment succeeds when 'attachments' is declared", async () => {
      const adapter = makeAdapterWithKnownConversation({ capabilities: ["text", "attachments"] });

      const result = await adapter.send({
        conversation,
        attachment: { kind: "file", source: { data: Buffer.from("hello") } },
      });

      expect(result.providerMessageId).toBeTruthy();
    });

    it("rejects an attachment send with ChatterUnsupportedCapabilityError when 'attachments' is not declared", async () => {
      const adapter = makeAdapterWithKnownConversation({ capabilities: ["text"] });

      await expect(
        adapter.send({ conversation, attachment: { kind: "file", source: { data: Buffer.from("x") } } }),
      ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);
      expect(adapter.sentMessages).toHaveLength(0);
    });

    it("rejects a { data } attachment exceeding maxAttachmentSizeBytes with ChatterConfigurationError", async () => {
      const adapter = makeAdapterWithKnownConversation({
        capabilities: ["text", "attachments"],
        maxAttachmentSizeBytes: 10,
      });

      await expect(
        adapter.send({
          conversation,
          attachment: { kind: "file", source: { data: Buffer.alloc(11) } },
        }),
      ).rejects.toBeInstanceOf(ChatterConfigurationError);
      expect(adapter.sentMessages).toHaveLength(0);
    });

    it("accepts a { data } attachment exactly at maxAttachmentSizeBytes (inclusive limit)", async () => {
      const adapter = makeAdapterWithKnownConversation({
        capabilities: ["text", "attachments"],
        maxAttachmentSizeBytes: 10,
      });

      await expect(
        adapter.send({
          conversation,
          attachment: { kind: "file", source: { data: Buffer.alloc(10) } },
        }),
      ).resolves.toBeDefined();
    });

    it("performs no size check when maxAttachmentSizeBytes is not configured", async () => {
      const adapter = makeAdapterWithKnownConversation({ capabilities: ["text", "attachments"] });

      await expect(
        adapter.send({
          conversation,
          attachment: { kind: "file", source: { data: Buffer.alloc(1_000_000) } },
        }),
      ).resolves.toBeDefined();
    });
  });
});
