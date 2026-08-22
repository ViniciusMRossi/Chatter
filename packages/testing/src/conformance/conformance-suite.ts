import {
  ChatterInvalidTargetError,
  ChatterUnsupportedCapabilityError,
  type AccountAdapter,
  type Attachment,
  type Conversation,
  type InboundMessage,
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
  /** A small, valid attachment used to exercise the "attachments" capability checks. */
  readonly getTestAttachment: () => Attachment;
  /**
   * Causes the adapter to dispatch at least one inbound message exercising mentions. To
   * satisfy the contract checks, the dispatched message(s) must between them include a
   * resolved mention (one carrying a `participant`), an unresolved one (carrying none), and
   * a mention of the adapter's own account (`isSelf: true`) alongside one that is not.
   *
   * REQUIRED for any adapter declaring the "mentions" capability — the suite fails rather
   * than skips when it is missing, so a declared capability cannot go unverified.
   *
   * This exists because every other check here drives the adapter through `send()`, which
   * cannot reach an inbound-only feature. Adapters supply it using whatever inbound path
   * they already have (e.g. a webhook handler fed a synthetic update).
   */
  readonly emitInboundWithMentions?: (adapter: AccountAdapter) => void | Promise<void>;
}

/**
 * Reusable conformance checks every AccountAdapter implementation must pass. Call this
 * from a Vitest file (it registers describe/it blocks when invoked) — the fake adapter is
 * the first adapter tested against it; every future provider adapter runs the same suite
 * unchanged, per constitution Principle IV.
 */
export function runAccountConformanceSuite(config: ConformanceSuiteConfig): void {
  const {
    createAdapter,
    getKnownConversation,
    getUnknownConversation,
    getTestAttachment,
    emitInboundWithMentions,
  } = config;

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

    it("send() with an attachment succeeds when 'attachments' is declared", async () => {
      const adapter = createAdapter();
      if (!adapter.getCapabilities().has("attachments")) {
        // Nothing to prove here — see the companion check below for the unsupported case. A
        // caller wanting this check exercised should construct an adapter instance that
        // declares "attachments".
        return;
      }

      await adapter.start(() => {
        // no-op
      });
      const conversation = await getKnownConversation(adapter);

      const result = await adapter.send({ conversation, attachment: getTestAttachment() });

      expect(result.provider).toBe(adapter.provider);
      expect(result.providerMessageId).toBeTruthy();
      expect(result.conversation).toBeDefined();

      await adapter.stop();
    });

    it("send() with an attachment rejects with ChatterUnsupportedCapabilityError when 'attachments' is not declared", async () => {
      const adapter = createAdapter();
      if (adapter.getCapabilities().has("attachments")) {
        // This adapter instance declares attachment support — nothing to prove unsupported
        // here. See the companion check above for the supported case.
        return;
      }

      await adapter.start(() => {
        // no-op
      });
      const conversation = await getKnownConversation(adapter);

      await expect(
        adapter.send({ conversation, attachment: getTestAttachment() }),
      ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);

      await adapter.stop();
    });

    it("reports inbound mentions satisfying the shared contract when 'mentions' is declared", async () => {
      const adapter = createAdapter();
      if (!adapter.getCapabilities().has("mentions")) {
        // Nothing to prove here — see the companion check below for the undeclared case.
        return;
      }
      if (emitInboundWithMentions === undefined) {
        // Deliberately a failure, not a skip. Every other capability check in this suite can
        // fall back to probing send(); mentions are inbound-only, so without this hook a
        // declared capability would go entirely unverified while still appearing to pass.
        throw new Error(
          "this adapter declares the 'mentions' capability, so ConformanceSuiteConfig must " +
            "supply emitInboundWithMentions — a declared capability cannot go unverified",
        );
      }

      const received: InboundMessage[] = [];
      await adapter.start((message) => {
        received.push(message);
      });
      await emitInboundWithMentions(adapter);

      const withMentions = received.filter((message) => message.mentions !== undefined);
      expect(
        withMentions.length,
        "emitInboundWithMentions must dispatch at least one message carrying mentions",
      ).toBeGreaterThan(0);

      const allMentions = withMentions.flatMap((message) => message.mentions ?? []);

      for (const message of withMentions) {
        const text = message.text;
        expect(text, "a message carrying mentions must carry the text they index into").toBeDefined();
        if (text === undefined) continue;

        for (const mention of message.mentions ?? []) {
          // The core invariant: a mention's reported position must isolate its reported text.
          expect(text.slice(mention.offset, mention.offset + mention.length)).toBe(mention.text);
          expect(mention.offset).toBeGreaterThanOrEqual(0);
          expect(mention.offset + mention.length).toBeLessThanOrEqual(text.length);
          expect(typeof mention.isSelf).toBe("boolean");
        }

        const offsets = (message.mentions ?? []).map((mention) => mention.offset);
        expect(offsets, "mentions must be ordered by where they appear in the text").toEqual(
          [...offsets].sort((a, b) => a - b),
        );
      }

      // Both resolution branches must be reachable, not merely assumed.
      expect(
        allMentions.some((mention) => mention.participant !== undefined),
        "expected at least one resolved mention",
      ).toBe(true);
      expect(
        allMentions.some((mention) => mention.participant === undefined),
        "expected at least one unresolved mention — an adapter that resolves everything is " +
          "likely fabricating identities",
      ).toBe(true);

      // No fabricated or placeholder identities.
      for (const mention of allMentions) {
        if (mention.participant === undefined) continue;
        expect(mention.participant.providerParticipantId).toBeTruthy();
        expect(mention.participant.providerParticipantId.trim()).not.toBe("");
      }

      // Both sides of the self signal must be reachable too.
      expect(
        allMentions.some((mention) => mention.isSelf),
        "expected at least one mention of the adapter's own account",
      ).toBe(true);
      expect(
        allMentions.some((mention) => !mention.isSelf),
        "expected at least one mention that is not of the adapter's own account",
      ).toBe(true);

      await adapter.stop();
    });

    it("reports no mentions on inbound messages when 'mentions' is not declared", async () => {
      const adapter = createAdapter();
      if (adapter.getCapabilities().has("mentions")) {
        // This adapter declares mention support — see the companion check above.
        return;
      }

      const received: InboundMessage[] = [];
      await adapter.start((message) => {
        received.push(message);
      });
      // getKnownConversation is the suite's existing way of making an adapter aware of a
      // conversation; for adapters that do so by driving their real inbound path, this also
      // gives us dispatched messages to inspect. Adapters that don't simply have nothing to
      // check here.
      await getKnownConversation(adapter);

      for (const message of received) {
        expect(message.mentions).toBeUndefined();
      }

      await adapter.stop();
    });
  });
}
