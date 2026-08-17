import {
  ChatterInvalidTargetError,
  ChatterUnsupportedCapabilityError,
  type AccountAdapter,
  type Conversation,
} from "@chatter/core";
import { describe, expect, it } from "vitest";

export interface ConformanceSuiteConfig {
  /** Creates a fresh adapter instance for each check. */
  readonly createAdapter: () => AccountAdapter;
  /**
   * Given a started adapter, makes it aware of a conversation it can legitimately send
   * to, and returns that conversation reference. For the fake adapter this means calling
   * its `emitInbound` test helper; a future real adapter's own conformance test file would
   * supply an equivalent using a real/sandboxed provider conversation.
   */
  readonly getKnownConversation: (adapter: AccountAdapter) => Conversation | Promise<Conversation>;
  /** A conversation reference the adapter has never seen and must reject as invalid. */
  readonly getUnknownConversation: () => Conversation;
}

/**
 * Reusable conformance checks every AccountAdapter implementation must pass. Call this
 * from a Vitest file (it registers describe/it blocks when invoked) — the fake adapter is
 * the first adapter tested against it; every future provider adapter runs the same suite
 * unchanged, per constitution Principle IV.
 */
export function runAccountConformanceSuite(config: ConformanceSuiteConfig): void {
  const { createAdapter, getKnownConversation, getUnknownConversation } = config;

  describe("AccountAdapter conformance", () => {
    it("declares a non-empty capability set", () => {
      const adapter = createAdapter();
      expect(adapter.getCapabilities().size).toBeGreaterThan(0);
    });

    it("start() and stop() are safe to call, including repeated calls", async () => {
      const adapter = createAdapter();
      await adapter.start(() => {
        // no-op: this check only exercises lifecycle safety, not dispatch.
      });
      await adapter.start(() => {
        // no-op
      });
      await adapter.stop();
      await adapter.stop();
    });

    it("send() to a known conversation returns a well-formed delivery result", async () => {
      const adapter = createAdapter();
      await adapter.start(() => {
        // no-op: this suite doesn't assert on inbound dispatch, only on send().
      });
      const conversation = await getKnownConversation(adapter);

      const result = await adapter.send({ conversation, text: "conformance check" });

      expect(result.provider).toBe(adapter.provider);
      expect(result.providerMessageId).toBeTruthy();
      expect(result.conversation).toBeDefined();

      await adapter.stop();
    });

    it("send() to an unrecognized conversation rejects with ChatterInvalidTargetError", async () => {
      const adapter = createAdapter();
      await adapter.start(() => {
        // no-op
      });

      await expect(
        adapter.send({ conversation: getUnknownConversation(), text: "should not send" }),
      ).rejects.toBeInstanceOf(ChatterInvalidTargetError);

      await adapter.stop();
    });

    it("send() requesting a capability the adapter did not declare rejects with ChatterUnsupportedCapabilityError", async () => {
      const adapter = createAdapter();
      const capabilities = adapter.getCapabilities();
      if (capabilities.has("thread")) {
        // This adapter instance declares every capability the suite knows how to probe —
        // nothing to prove unsupported here. A caller wanting this check exercised should
        // construct their adapter instance with a deliberately restricted capability set.
        return;
      }

      await adapter.start(() => {
        // no-op
      });
      const conversation = await getKnownConversation(adapter);

      await expect(
        adapter.send({
          conversation: { ...conversation, providerThreadId: "conformance-thread" },
          text: "should not send",
        }),
      ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);

      await adapter.stop();
    });
  });
}
