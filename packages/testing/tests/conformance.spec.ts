import type { Attachment } from "@chatter/core";
import { FakeAccountAdapter, runAccountConformanceSuite } from "../src/index.js";

let counter = 0;

function makeKnownConversationGetter() {
  return async (adapter: unknown) => {
    const fake = adapter as FakeAccountAdapter;
    counter += 1;
    const conversation = {
      provider: "fake",
      providerAccountId: "conformance-acct",
      providerConversationId: `conformance-dm-${String(counter)}`,
      type: "direct" as const,
    };
    fake.emitInbound({
      id: `conformance-msg-${String(counter)}`,
      provider: "fake",
      sender: {
        provider: "fake",
        providerAccountId: "conformance-acct",
        providerParticipantId: "conformance-user",
      },
      conversation,
      text: "seed message",
      createdAt: new Date(),
    });
    return Promise.resolve(conversation);
  };
}

const getUnknownConversation = () => ({
  provider: "fake",
  providerAccountId: "conformance-acct",
  providerConversationId: "never-registered",
  type: "direct" as const,
});

const getTestAttachment = (): Attachment => ({
  kind: "file",
  source: { data: Buffer.from("conformance attachment") },
});

runAccountConformanceSuite({
  // A deliberately restricted capability set so the suite's unsupported-capability checks
  // (thread and attachments) have something to exercise (a default FakeAccountAdapter
  // declares every capability the suite knows how to probe, which would make those checks
  // no-ops).
  createAdapter: () => new FakeAccountAdapter({ capabilities: ["text"] }),
  getKnownConversation: makeKnownConversationGetter(),
  getUnknownConversation,
  getTestAttachment,
});

runAccountConformanceSuite({
  // A capability set that DOES include "attachments", so the suite's supported-attachment
  // check (otherwise a no-op above) is actually exercised too — proving both branches per
  // spec.md's SC-006.
  createAdapter: () => new FakeAccountAdapter({ capabilities: ["text", "attachments"] }),
  getKnownConversation: makeKnownConversationGetter(),
  getUnknownConversation,
  getTestAttachment,
});

runAccountConformanceSuite({
  // A capability set including the inbound-only capabilities, so the suite's mention AND edit
  // contract checks run for real. The two runs above declare neither and therefore exercise
  // the companion negative checks (no mentions, no edited messages) — both branches proven,
  // same pattern as "attachments".
  createAdapter: () =>
    new FakeAccountAdapter({ capabilities: ["text", "mentions", "editNotifications"] }),
  getKnownConversation: makeKnownConversationGetter(),
  getUnknownConversation,
  getTestAttachment,
  emitInbound: (adapter, scenario) => {
    const fake = adapter as FakeAccountAdapter;
    if (scenario === "mentions") {
      fake.emitInboundWithMentions();
      return;
    }
    fake.emitInboundEdit();
  },
});
