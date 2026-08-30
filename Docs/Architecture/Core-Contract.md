# Chatter — Core Contract Finalization

## Status

**Accepted / Frozen for implementation after final consistency review**

This document records the Core contract decisions accepted after two independent architecture reviews.

It exists to make the final decisions easy to review without rereading the full project context, roadmap, and review history.

---

# 1. Named Rules

## Rule N — No implicit I/O

Inbound normalization is pure and synchronous.

Provider data already present in the event may be normalized into snapshots.

Additional provider requests are explicit operations.

## Rule S — Semantics vs authorization

Capabilities describe whether an operation is semantically supported in the current context.

They do not promise that the provider will authorize/accept a specific attempt.

Policy, permission, rate-limit, time-window, and provider-state rejection surfaces as normalized errors.

---

# 2. Entity Refs

Frozen direction:

```ts
ProviderAccountRef { provider, accountId }
ConversationRef    { provider, accountId, id }
ParticipantRef     { provider, accountId, id }
MessageRef         { provider, accountId, conversationId, id }
ThreadRef          { provider, accountId, conversationId, id }
```

Required Core helpers:

- canonical format/parse;
- `conversationRefOf(messageRef)`;
- account-bound RefFactory.

---

# 2A. Conversation extensibility

`Conversation` may include:

```ts
parent?: ConversationRef;
```

for conversation-shaped child contexts such as Telegram forum topics or Discord thread channels. This is distinct from a future workspace/guild container concept.

# 3. Message Hydration

Frozen direction:

```ts
Message {
  ref: MessageRef;
  conversation: Conversation;
  sender: Participant;
  isOwn: boolean;
  content: MessageContent;
  replyTo?: MessageRef;
  thread?: ThreadRef;
  reactions?: ReactionSummary[];
  editedAt?: Date;
  createdAt?: Date;
  receivedAt: Date;
  raw?: unknown;
}
```

Provider-supplied snapshots only.

Core stamps `receivedAt`.

`isOwn` must be deterministic. An adapter must not default it to `false` merely because `self` is unavailable; successful startup/emission must establish enough identity to classify ownership or the provider feature's human-approved `spec.md` must explicitly resolve the gap.

---

# 4. Content Model

```ts
MessageContent {
  text?: string;
  attachments: Attachment[];
  parts?: ContentPart[];
  extensions?: ProviderContent[];
}
```

Initial attachments:

```text
image
video
audio
file
sticker
```

Initial content parts:

```text
location
contact
```

Open-union fallback is mandatory for consumers.

Governed open sets:

```text
Attachment
ContentPart
ConversationType
AccountState
ChatterErrorCategory
Capability
```

`ProviderContent` must expose stable `provider` and provider-prefixed `type` discriminants. Provider packages may add richer typed variants.

---

# 5. Operations

Hybrid model:

```text
Chatter:
  lifecycle
  registry
  events
  handle construction
  send convenience
  reply convenience

MessageHandle:
  reply
  edit
  delete
  react
  unreact
  thread
  fetch
  media retrieval

ConversationHandle:
  send
  typing
  info/resolve
  history when provider supports it

Typed provider account:
  provider-specific APIs
```

`reply()` accepts `MessageRef | Message`.

---

# 5A. SentMessage

`SentMessage` is a send receipt.

```ts
SentMessage {
  ref?: MessageRef;
  conversation: ConversationRef;
  createdAt?: Date;
  raw?: unknown;
}
```

Do not fabricate provider ids. A successful provider send without a stable id remains successful, but entity-targeted operations are unavailable until a real ref exists.

# 6. Capabilities

Open namespace.

Core keys unprefixed.

Provider keys prefixed.

Typed `CapabilityRegistry` extensible by provider packages.

Resolution is synchronous and pure at:

```text
account
conversation
message
```

Resolution is independent of lifecycle `AccountState`; effective operation availability is derived from health plus capability support.

Descriptors are typed per capability.

No universal metadata bag.

---

# 7. Lifecycle

Known states:

```text
idle
starting
ready
reconnecting
failed
stopping
stopped
```

`AccountState` is governed by the open-union rule, so future meaningful states can be added without forcing consumers into a breaking exhaustive switch.

No global startup rollback.

No `degraded` until a real semantic is specified.

`start()`:

- attempts all accounts;
- resolves with per-account initial result;
- during initial startup, an account that cannot reach `ready` transitions to `failed`; `reconnecting` is post-startup only and may not keep `start()` pending indefinitely;
- background reconnection may continue after `start()` resolves;
- healthy accounts survive other account failures;
- rejects only pre-flight/configuration failures.

---

# 8. Events

Reserved common names:

```text
message
message.updated
message.deleted
reaction.added
reaction.removed
account.state
capabilities.changed
error
```

Provider-specific events stay provider-specific.

Reactions are events plus optional immutable provider snapshots, not Chatter-maintained live state.

---

# 9. Media

`attachment.download` is shared and capability-gated.

Retrieval returns stream/metadata.

No storage, re-hosting, or browser-authenticated provider URLs.

---

# 10. Errors

Stable serialized contract:

```text
code
category
retryable?
retryAfterMs?
provider?
accountId?
operation?
correlationId?
```

Classes are ergonomic.

`code` is the cross-boundary contract.

`cause` is preserved internally but excluded from default JSON serialization.

Add `ProviderPolicyError`.

`ChatterErrorCategory` is governed by the open-union rule. Provider-specific **codes** are an open namespace and do not require provider-specific categories.

---

# 11. WhatsApp Customer-Service Window

Chatter stores no conversation history for this.

Provider is authoritative.

Expired window:

```text
ProviderPolicyError
code = WHATSAPP_CUSTOMER_SERVICE_WINDOW_EXPIRED
retryable = false
```

No Core `recovery: send-template`.

Provider-specific clients may use the code to offer templates.

Map by provider numeric/structured error code, not message text.

---

# 12. Adapter SPI

Must exist before provider implementation.

Required concerns:

- identity;
- init/start/stop;
- sync capability resolution;
- send;
- optional capability operations;
- self identity sufficient to determine `isOwn` for emitted messages;
- native client;
- normalized emit surface;
- account state;
- provider-specific events;
- provider error mapping;
- raw-body webhook request handling;
- bound RefFactory;
- AbortSignal/logger/clock.

SPI is internal-but-stable.

---

# 13. Testing Control

Contract framework before lifecycle/outbound implementation.

Testing fake has provider-shaped profiles and hostile scenarios.

A fake never proves provider support.

A contract suite becomes externally validated only when a real adapter passes it.

The fake must also support provider-policy refusal of one operation while another valid alternative remains available, so policy-error flows can be tested without requiring live credentials.

---

# 14. Core Freeze Gate

Before **Phase 8 (WhatsApp Driver Layer)** begins, Core is frozen only after:

- approve cross-provider mapping;
- pressure-test Slack and Telegram semantics on paper;
- run fake profiles;
- resolve contradictions;
- then freeze Core and implement WhatsApp depth-first.

---

# 15. Deliberately Deferred

- exact history pagination;
- example-client transport;
- reconnect timing numbers;
- manual retry API;
- container/guild/workspace model;
- descriptor details not needed by current V1;
- diagnostics tap internals;
- outbound stream attachment source;
- provider-specific future APIs.


---

# 16. Maintenance Rule

Any human-approved Spec Kit feature whose `spec.md` or `plan.md` changes or extends a frozen Core contract must update this document in the same change.

If the change also alters a Chatter constitutional rule, the constitution must be amended and explicitly approved before implementation proceeds.

Do not allow feature artifacts, the constitution, and the Core Contract record to drift independently.
