# Quickstart: Validating the Attachment Model

Prerequisites: pnpm installed and workspace dependencies installed (`pnpm install` from repo
root). No network access, credentials, or external services required — everything here runs
against `@chatter/testing`'s fake adapter, exactly like ticket #1.

## 1. Install and build

```bash
pnpm install
pnpm -r build      # or pnpm -r typecheck during development
```

## 2. Run the automated test suite (primary validation)

```bash
pnpm -r test
```

Expected: all existing `@chatter/core`/`@chatter/testing` tests continue to pass unmodified
(SC-005), and the newly-extended conformance suite's attachment checks pass (SC-006).

## 3. Receiving an attachment (Story 1)

```ts
import { Chatter } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

const fake = new FakeAccountAdapter({ capabilities: ["text", "attachments"] });
const chatter = new Chatter({ accounts: [{ accountName: "support-bot", adapter: fake }] });

let received: unknown;
chatter.on("message.created", (event) => { received = event.message.attachments; });

await chatter.start();

fake.emitInbound({
  provider: "fake",
  id: "msg-1",
  sender: { provider: "fake", providerAccountId: "acct-1", providerParticipantId: "user-1" },
  conversation: { provider: "fake", providerAccountId: "acct-1", providerConversationId: "dm-1", type: "direct" },
  // no text — attachment-only, per Story 1 Scenario 2
  attachments: [{ kind: "image", source: { url: "https://example.com/cat.png" }, mimeType: "image/png" }],
  createdAt: new Date(),
});

// Expected: received === [{ kind: "image", source: { url: "..." }, mimeType: "image/png" }]
await chatter.stop();
```

## 4. Sending an attachment (Story 2)

```ts
// Remote reference — no bytes through Chatter:
await chatter.send({
  account: "support-bot",
  conversation: someConversation,
  attachment: { kind: "file", source: { url: "https://example.com/report.pdf" }, fileName: "report.pdf" },
});

// Directly-supplied content:
await chatter.send({
  account: "support-bot",
  conversation: someConversation,
  text: "here's the photo",
  attachment: { kind: "image", source: { data: Buffer.from([/* ... */]) }, mimeType: "image/jpeg" },
});

// Expected: both resolve with a DeliveryResult, same shape as an existing text-only send.
```

## 5. Unsupported-capability rejection (Story 3)

```ts
import { ChatterUnsupportedCapabilityError } from "@chatter/core";

const noAttachments = new FakeAccountAdapter({ capabilities: ["text"] });
// ... register under Chatter, start() ...

await expect(
  chatter.send({ account: "no-attachments", conversation: someConversation, attachment: someAttachment })
).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);
```

## 6. Oversized-attachment rejection (Story 4)

```ts
import { ChatterConfigurationError } from "@chatter/core";

const limited = new FakeAccountAdapter({ capabilities: ["attachments"], maxAttachmentSizeBytes: 10 });

await expect(
  chatter.send({
    account: "limited",
    conversation: someConversation,
    attachment: { kind: "file", source: { data: Buffer.alloc(11) } },
  })
).rejects.toBeInstanceOf(ChatterConfigurationError);

// Expected also: limited.sentMessages remains empty — nothing resembling a transmission occurred.
```

## 7. Conformance suite reusability check (Story 5)

```ts
import { FakeAccountAdapter, runAccountConformanceSuite } from "@chatter/testing";

runAccountConformanceSuite({
  createAdapter: () => new FakeAccountAdapter({ capabilities: ["text", "attachments"] }),
  getKnownConversation: async (adapter) => { /* as in ticket #1 */ },
  getUnknownConversation: () => ({ /* as in ticket #1 */ }),
  getTestAttachment: () => ({ kind: "file", source: { data: Buffer.from("test") } }),
});
```

Run the same suite a second time against `new FakeAccountAdapter({ capabilities: ["text"] })`
(no `"attachments"`) and confirm the suite's attachment-rejection check passes rather than being
silently skipped — this is the proof required by SC-006.
