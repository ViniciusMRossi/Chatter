import {
  ChatterInvalidTargetError,
  ChatterUnsupportedCapabilityError,
  type AccountAdapter,
  type Attachment,
  type Capability,
  type Conversation,
  type InboundEvent,
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
   * Drives the adapter's real inbound path to produce the named scenario.
   *
   * REQUIRED for any adapter declaring a capability that maps to a scenario (see
   * SCENARIO_FOR_CAPABILITY below) — the suite FAILS rather than skips when it is missing,
   * so a declared capability cannot go unverified.
   *
   * This exists because every other check here drives the adapter through `send()`, which
   * cannot reach an inbound-only feature at all. Adapters supply it using whatever inbound
   * path they already have (e.g. a webhook handler fed a synthetic update).
   *
   * Deliberately ONE hook taking a scenario name rather than one hook per feature: the
   * previous shape was mention-specific, and a second inbound feature would have made
   * per-feature hooks the permanent pattern. A further inbound feature adds a member to
   * `InboundScenario` and a row to the table — not a new config field.
   */
  readonly emitInbound?: (
    adapter: AccountAdapter,
    scenario: InboundScenario,
  ) => void | Promise<void>;
}

/**
 * An inbound behavior the suite knows how to exercise. Add a member here (and a row in
 * SCENARIO_FOR_CAPABILITY) when a new inbound-only capability arrives.
 */
export type InboundScenario = "mentions" | "edit";

/**
 * Which capabilities oblige a config to supply `emitInbound`, and for which scenario.
 * A declared capability with no way to exercise it is a suite failure, never a skip.
 */
const SCENARIO_FOR_CAPABILITY: readonly (readonly [Capability, InboundScenario])[] = [
  ["mentions", "mentions"],
  ["editNotifications", "edit"],
];

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
    emitInbound,
  } = config;

  /**
   * Returns the emitter for `scenario`, or throws naming what is missing.
   *
   * Deliberately a failure, not a skip. Every other capability check in this suite can fall
   * back to probing `send()`; inbound-only features cannot be reached that way at all, so a
   * silent skip would leave a DECLARED capability entirely unverified while still appearing
   * to pass. Skipping is right for probing a capability an adapter did not declare; for one
   * it did, it is the worst possible outcome.
   */
  function requireEmitter(
    capability: Capability,
    scenario: InboundScenario,
  ): (adapter: AccountAdapter, scenario: InboundScenario) => void | Promise<void> {
    if (emitInbound === undefined) {
      throw new Error(
        `this adapter declares the '${capability}' capability, so ConformanceSuiteConfig ` +
          `must supply emitInbound to exercise the '${scenario}' scenario — a declared ` +
          "capability cannot go unverified",
      );
    }
    return emitInbound;
  }

  describe("AccountAdapter conformance", () => {
    it("supplies emitInbound for every declared capability that needs it", () => {
      const adapter = createAdapter();
      for (const [capability, scenario] of SCENARIO_FOR_CAPABILITY) {
        if (adapter.getCapabilities().has(capability)) {
          requireEmitter(capability, scenario);
        }
      }
    });
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
      const emit = requireEmitter("mentions", "mentions");

      const received: InboundMessage[] = [];
      await adapter.start((event) => {
        received.push(event.message);
      });
      await emit(adapter, "mentions");

      const withMentions = received.filter((message) => message.mentions !== undefined);
      expect(
        withMentions.length,
        "emitInbound('mentions') must dispatch at least one message carrying mentions",
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

    it("reports inbound edits satisfying the shared contract when 'editNotifications' is declared", async () => {
      const adapter = createAdapter();
      if (!adapter.getCapabilities().has("editNotifications")) {
        // Nothing to prove here — see the companion check below for the undeclared case.
        return;
      }
      const emit = requireEmitter("editNotifications", "edit");

      const events: InboundEvent[] = [];
      await adapter.start((event) => {
        events.push(event);
      });
      await emit(adapter, "edit");

      const created = events.filter((event) => event.kind === "message.created");
      const edited = events.filter((event) => event.kind === "message.edited");

      expect(
        edited.length,
        "emitInbound('edit') must dispatch at least one 'message.edited' event",
      ).toBeGreaterThan(0);

      // THE invariant with real blast radius. Applications written before edits existed
      // append or act on whatever arrives as "message.created"; an edit delivered there
      // makes every one of them double-handle, with nothing to tell the cases apart. Assert
      // the ABSENCE, not merely that an edit also showed up somewhere.
      for (const event of created) {
        expect(
          event.message.editedAt,
          "a 'message.created' event must never carry an edited message — edits belong to " +
            "'message.edited' alone",
        ).toBeUndefined();
      }

      for (const event of edited) {
        const message = event.message;

        // An edit reuses the id the message was first delivered under, so an application
        // can correlate without comparing content.
        expect(message.id, "an edited message must keep its original id").toBeTruthy();

        expect(
          message.editedAt,
          "an edited message must report when it was last edited",
        ).toBeInstanceOf(Date);
        expect(
          message.createdAt,
          "an edited message must still report when it was ORIGINALLY sent",
        ).toBeInstanceOf(Date);
        const editedAt = message.editedAt;
        if (editedAt !== undefined) {
          expect(editedAt.getTime(), "editedAt cannot precede createdAt").toBeGreaterThanOrEqual(
            message.createdAt.getTime(),
          );
        }

        // If the emitter dispatched the original too, createdAt must be untouched by the
        // edit — an edit reports a change of content, never a change of when it was sent.
        const original = created.find((c) => c.message.id === message.id);
        if (original !== undefined) {
          expect(
            message.createdAt.getTime(),
            "an edit must not overwrite the original send time",
          ).toBe(original.message.createdAt.getTime());
          // The key must be ABSENT on a never-edited message, not present-and-undefined —
          // that is what keeps an unedited message identical in shape to before edits
          // existed.
          expect(
            "editedAt" in original.message,
            "a message that has not been edited must not carry an editedAt key at all",
          ).toBe(false);
        }
      }

      await adapter.stop();
    });

    it("reports no edited messages when 'editNotifications' is not declared", async () => {
      const adapter = createAdapter();
      if (adapter.getCapabilities().has("editNotifications")) {
        // This adapter declares edit reporting — see the companion check above.
        return;
      }

      const events: InboundEvent[] = [];
      await adapter.start((event) => {
        events.push(event);
      });
      await getKnownConversation(adapter);

      for (const event of events) {
        expect(event.kind).toBe("message.created");
        expect(event.message.editedAt).toBeUndefined();
      }

      await adapter.stop();
    });

    it("reports no mentions on inbound messages when 'mentions' is not declared", async () => {
      const adapter = createAdapter();
      if (adapter.getCapabilities().has("mentions")) {
        // This adapter declares mention support — see the companion check above.
        return;
      }

      const received: InboundMessage[] = [];
      await adapter.start((event) => {
        received.push(event.message);
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
