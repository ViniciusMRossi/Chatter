import { ChatterRateLimitError } from "@chatter/core";
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
});
