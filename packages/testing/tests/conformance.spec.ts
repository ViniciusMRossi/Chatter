import { FakeAccountAdapter, runAccountConformanceSuite } from "../src/index.js";

let counter = 0;

runAccountConformanceSuite({
  // A deliberately restricted capability set so the suite's unsupported-capability check
  // has something to exercise (a default FakeAccountAdapter declares every capability the
  // suite knows how to probe, which would make that one check a no-op).
  createAdapter: () => new FakeAccountAdapter({ capabilities: ["text"] }),

  getKnownConversation: async (adapter) => {
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
  },

  getUnknownConversation: () => ({
    provider: "fake",
    providerAccountId: "conformance-acct",
    providerConversationId: "never-registered",
    type: "direct",
  }),
});
