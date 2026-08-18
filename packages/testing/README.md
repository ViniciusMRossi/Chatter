# @chatter/testing

Test utilities for [Chatter](../../README.md): an in-memory `FakeAccountAdapter` and a
reusable, adapter-agnostic conformance suite (`runAccountConformanceSuite`) that any
`AccountAdapter` implementation — the fake one now, real provider adapters later — must pass.

## Install

```bash
pnpm add -D @chatter/testing
```

`vitest` is a peer dependency: `runAccountConformanceSuite` registers Vitest `describe`/`it`
blocks when called, so the consuming package needs Vitest available.

## `FakeAccountAdapter`

An in-memory `AccountAdapter` with no network access or real credentials required.

```ts
import { FakeAccountAdapter } from "@chatter/testing";

const fake = new FakeAccountAdapter({ capabilities: ["text", "reply"] }); // "thread" omitted

fake.emitInbound({
  id: "msg-1",
  provider: "fake",
  sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
  conversation: {
    provider: "fake",
    providerAccountId: "acct-1",
    providerConversationId: "dm-1",
    type: "direct",
  },
  text: "hello",
  createdAt: new Date(),
});

// fake.sentMessages accumulates everything sent through it.
// fake.simulateRateLimit(2000) makes the *next* send() reject with ChatterRateLimitError.
```

`emitInbound`, `sentMessages`, and `simulateRateLimit` are fake-adapter-only test ergonomics —
not part of the `AccountAdapter` contract, so they're not assumed by the conformance suite.

`FakeAccountAdapter` also accepts `maxAttachmentSizeBytes` in its config — when set, `send()`
rejects a `{ data: Buffer }`-sourced attachment whose byte length exceeds it with
`ChatterConfigurationError`, before recording anything in `sentMessages`. Unset means no size
check. A `send()` carrying `attachment` also requires the `"attachments"` capability, exactly
like `"reply"`/`"thread"` already require their own capabilities.

## `runAccountConformanceSuite`

Takes a config object rather than a bare adapter factory, because a generic suite has no way to
know how to make an arbitrary adapter aware of a "known" conversation — that's adapter-specific:

```ts
import { FakeAccountAdapter, runAccountConformanceSuite } from "@chatter/testing";

runAccountConformanceSuite({
  createAdapter: () => new FakeAccountAdapter({ capabilities: ["text"] }),
  getKnownConversation: async (adapter) => {
    const fake = adapter as FakeAccountAdapter;
    const conversation = {
      provider: "fake",
      providerAccountId: "acct-1",
      providerConversationId: "dm-1",
      type: "direct" as const,
    };
    fake.emitInbound({ id: "seed", provider: "fake", sender: /* ... */, conversation, text: "seed", createdAt: new Date() });
    return conversation;
  },
  getUnknownConversation: () => ({
    provider: "fake",
    providerAccountId: "acct-1",
    providerConversationId: "never-seen",
    type: "direct",
  }),
  getTestAttachment: () => ({ kind: "file", source: { data: Buffer.from("test") } }),
});
```

A future real adapter's own test file would supply the same shape of config, using a real (or
sandboxed) provider conversation for `getKnownConversation` — the suite itself never changes.

`getTestAttachment` (required) supplies a small, valid `Attachment` the suite uses to prove both
that a send with an attachment succeeds when the adapter declares `"attachments"`, and that it
rejects with `ChatterUnsupportedCapabilityError` when it doesn't — whichever is relevant to the
capability set the adapter instance under test was constructed with; the other check is a no-op
for that instance.
