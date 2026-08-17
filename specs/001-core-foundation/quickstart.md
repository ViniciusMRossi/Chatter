# Quickstart: Validating Core Package Foundation

Prerequisites: pnpm installed and workspace dependencies installed (`pnpm install` from repo
root). No network access, credentials, or external services required — everything here runs
against `@chatter/testing`'s fake adapter.

## 1. Install and build

```bash
pnpm install
pnpm -r build      # or pnpm -r typecheck during development
```

## 2. Run the automated test suite (primary validation)

```bash
pnpm -r test
```

Expected: all `@chatter/core` unit/integration tests pass, and `@chatter/testing`'s test file
(which calls `runAccountConformanceSuite` against `FakeAccountAdapter`) passes with zero
failures — this is SC-003 and SC-004 from spec.md.

## 3. Manual round-trip validation (Story 1)

```ts
import { Chatter } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

const fake = new FakeAccountAdapter();
const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter: fake }] });

chatter.on("message.created", async (event) => {
  await chatter.send({
    account: event.account,
    conversation: event.message.conversation,
    text: `echo: ${event.message.text}`,
    replyToMessageId: event.message.id,
  });
});

await chatter.start();

fake.emitInbound({
  provider: "fake",
  id: "msg-1",
  sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
  conversation: { provider: "fake", providerAccountId: "acct-1", providerConversationId: "dm-1", type: "direct" },
  text: "hello",
  createdAt: new Date(),
});

// Expected: fake.sentMessages has one entry — echo reply, correct conversation.
await chatter.stop();
```

## 4. Multi-account isolation check (Story 2)

Register two `FakeAccountAdapter` instances under `"bot-a"` and `"bot-b"`, emit distinct inbound
messages on each, and confirm each handler invocation reports the correct `event.account`, and
that `botA.sentMessages` / `botB.sentMessages` never cross-contaminate.

## 5. Error-path checks (Story 3)

```ts
import { ChatterRateLimitError } from "@chatter/core";

fake.simulateRateLimit(2000);
await expect(chatter.send({ account: "support-bot", conversation: someConversation, text: "x" }))
  .rejects.toBeInstanceOf(ChatterRateLimitError);
```

Repeat the pattern for an unknown conversation reference (expect `ChatterInvalidTargetError`)
and a thread-targeted send on an adapter constructed without the `"thread"` capability (expect
`ChatterUnsupportedCapabilityError`).

## 6. Conformance suite reusability check (Story 4)

`runAccountConformanceSuite` takes a config object, not a bare adapter factory — a truly
adapter-agnostic suite can't know how to make an arbitrary adapter aware of a "known"
conversation (that's adapter-specific: `emitInbound` for the fake adapter, a real send on a
sandboxed conversation for a future real one):

```ts
import { FakeAccountAdapter, runAccountConformanceSuite } from "@chatter/testing";

runAccountConformanceSuite({
  createAdapter: () => new FakeAccountAdapter({ capabilities: ["text"] }),
  getKnownConversation: async (adapter) => {
    /* call adapter.emitInbound(...) (or the real-adapter equivalent) and return
       the conversation reference it just registered */
  },
  getUnknownConversation: () => ({ provider: "fake", providerAccountId: "x", providerConversationId: "never-seen", type: "direct" }),
});
```

To prove the suite actually constrains behavior: temporarily modify `FakeAccountAdapter.send()`
to omit `conversation` from its returned delivery result, re-run `pnpm -r test`, and confirm the
suite fails with a clear assertion pointing at the missing field. Revert the change afterward —
this is a one-time manual proof, not a permanent test.
