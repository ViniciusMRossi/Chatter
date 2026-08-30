# Chatter — Project Context and Architectural Constraints

## Purpose

This document is the authoritative project-level context for planning and implementing Chatter features. It records product architecture, boundaries, frozen decisions, and constraints that feature-level work must preserve.

It is **not** a feature specification and it does not define the development workflow. Chatter is intended to be developed through SpecMan. When discovery is needed, Feature Planning produces a **Feature Planning Brief** that is input to the Spec Kit lifecycle; the brief is not canonical. The canonical behavioral source for a feature is its human-approved Spec Kit `spec.md`, the canonical technical source is `plan.md`, and the execution source is `tasks.md`.

Do not duplicate SpecMan or Spec Kit command syntax in this document. Follow the repository's generated `AGENTS.md` for workflow mechanics and use this document to avoid reopening settled Chatter architecture or implementing superseded decisions.

### Workflow ownership boundary

The human-approved Chatter constitution is the **normative governance source** for the two-axis authority model. This section is only a project-context summary and MUST NOT become a competing governance definition.

In summary, Chatter owns project-specific product and architecture rules while SpecMan owns reusable workflow mechanics. If workflow behavior and a Chatter project rule appear to conflict, follow the constitution's conflict rule and require human resolution.

The constitution also provides the explicit path-based route from the SpecMan instruction chain to this Project Context, the Core Contract, roadmap, cross-provider mapping, accepted decisions, and relevant design records.

---

# 1. Product Definition

Chatter is a Node.js + TypeScript messaging integration library.

Its purpose is to give applications a stable integration surface across multiple messaging providers while preserving real provider-specific behavior.

Provider implementation order is strict:

1. WhatsApp
2. Slack
3. Telegram
4. Discord

WhatsApp is the first reference adapter, but Core must be pressure-tested against the other providers before its public contract is frozen.

---

# 2. Frozen Product Principles

> **Chatter provides a single integration surface, not a single capability surface.**

> **Chatter does not abstract away platform differences. It abstracts away platform integration.**

> **Design cross-provider. Implement provider-by-provider. Finish before moving forward. WhatsApp first.**

> **Unsupported semantics must never silently degrade into different semantics.**

> **Chatter transports and normalizes messaging behavior. Applications own business state and conversation persistence.**

Two additional rules are now frozen.

## Rule N — No implicit I/O

Inbound normalization is pure and synchronous.

An adapter must not perform a provider/network call merely to enrich an inbound message.

If a provider includes useful metadata in the inbound payload, Chatter preserves it as a snapshot.

If enrichment requires another request, that enrichment is an explicit, capability-gated operation.

## Rule S — Semantics vs authorization

A capability answers:

> Does the provider model support this kind of operation in this context?

A capability does **not** guarantee:

> Will the provider accept this specific attempt right now?

Permission, policy, rate limit, account state, time-window state, and other provider decisions may still reject a semantically supported operation and must surface as normalized errors.

Capability resolution therefore remains synchronous and pure.

---

# 3. Scope Boundary

Chatter owns:

- provider integration;
- provider/account lifecycle;
- send and receive operations;
- normalized common entities;
- provider-specific structured content;
- capability discovery;
- provider-specific stable APIs;
- normalized errors;
- media retrieval as transport;
- framework-neutral webhook integration;
- test contracts for adapter behavior.

Chatter does **not** own:

- LLM behavior;
- prompts;
- memory/RAG;
- CRM workflows;
- application conversation databases;
- unread state;
- drafts;
- local search;
- application conversation ordering;
- long-term observed message history;
- business-specific automation;
- application-level offline send queues.

---

# 4. Repository Architecture

```text
packages/
├── core/
├── testing/
├── whatsapp/
├── slack/
├── telegram/
└── discord/

apps/
├── validation-server/
└── example-client/

bruno/
└── ...
```

## `@chatter/core`

Owns:

- Chatter runtime;
- public common types;
- entity refs;
- account registry;
- lifecycle;
- events;
- common capability registry;
- handle abstractions;
- common errors;
- media retrieval contract;
- adapter SPI types;
- framework-neutral webhook request/response types.

Core must not import provider SDKs.

## `@chatter/testing`

Owns:

- reusable adapter contract suites;
- fixtures;
- assertions;
- harness utilities;
- fake provider profiles.

A contract suite is **not considered externally validated until at least one real adapter passes it**. The fake proves expressibility and internal consistency, not provider truth.

## Provider packages

Own:

- provider SDK integration;
- normalization;
- provider error mapping;
- provider-specific capabilities;
- provider-specific stable APIs;
- provider-specific events;
- provider integration tests.

Provider packages must not depend on each other.

## `apps/validation-server`

Consumes Chatter exactly as an external application would.

Used by Bruno acceptance tests.

Must never bypass Chatter.

## `apps/example-client`

Browser-based reference application implemented by the main Chatter agent.

Architecture:

```text
Browser
  ↓
Example Client Server
  ↓
Chatter
  ↓
Provider adapters
```

Provider credentials and native SDK clients must never reach browser code.

---

# 5. Provider SDK Strategy

Initial intended implementations:

- WhatsApp: `meta-cloud-api` behind an internal `WhatsAppDriver`
- Slack: `@slack/bolt` + `@slack/web-api`
- Telegram: `grammy`
- Discord: `discord.js`

The WhatsApp stack is intentionally:

```text
WhatsAppAdapter
  ↓
WhatsAppDriver
  ↓
MetaCloudApiDriver
  ↓
meta-cloud-api
```

`meta-cloud-api` is the **initial driver implementation**, not a permanent public dependency contract.

Provider SDK types must not leak into `@chatter/core`.

---

# 6. Entity Identity

## Provider account

```ts
export interface ProviderAccountRef {
  provider: string;
  accountId: string;
}
```

Identity is `provider + accountId`.

`accountId` is Chatter-configured identity, not necessarily the upstream account id.

## Conversation

```ts
export interface ConversationRef extends ProviderAccountRef {
  id: string;
}
```

## Participant

```ts
export interface ParticipantRef extends ProviderAccountRef {
  id: string;
}
```

## Message

`MessageRef` includes conversation context because provider operations generally require it.

```ts
export interface MessageRef extends ProviderAccountRef {
  conversationId: string;
  id: string;
}
```

## Thread

```ts
export interface ThreadRef extends ProviderAccountRef {
  conversationId: string;
  id: string;
}
```

Core must provide canonical ref serialization/parsing helpers and a helper equivalent to:

```ts
conversationRefOf(messageRef)
```

Applications should not invent incompatible ref serialization.

Refs may embed provider-native identifiers that are personal data (for example, a WhatsApp phone-number conversation id). Default logging/diagnostics must therefore redact or hash `id` and `conversationId` components rather than logging canonical refs verbatim.

Provider-native ids remain visible. Chatter does not replace them with arbitrary UUIDs merely for normalization.

---

# 7. Conversation Model

Use `Conversation`, not `Channel`, as the universal concept.

```ts
export type KnownConversationType =
  | "direct"
  | "group"
  | "channel";

export type ConversationType =
  | KnownConversationType
  | (string & {});
```

Conversation snapshots:

```ts
export interface Conversation {
  ref: ConversationRef;
  type: ConversationType;
  title?: string;

  // Optional parent for conversation-shaped child contexts such as
  // Telegram forum topics or Discord thread channels.
  parent?: ConversationRef;

  raw?: unknown;
}
```

Do not fabricate unavailable titles or metadata.

Design `Conversation` so an optional future provider-container reference can be added additively for concepts such as Slack workspaces and Discord guilds, but do not implement a universal provider-container domain model until required.

---

# 8. Participant Model

```ts
export interface Participant {
  ref: ParticipantRef;
  displayName?: string;
  username?: string;
  isBot?: boolean;
  raw?: unknown;
}
```

Inbound messages carry the participant snapshot supplied by the provider payload.

No implicit provider lookup is permitted during normalization.

Optional enrichment may later use capability-gated participant resolution where the provider supports it.

Each account should expose its own normalized participant identity:

```ts
account.self
```

Ownership must never silently default to `false` because self identity is unavailable. An adapter that emits normalized messages must be able to determine `isOwn` for those messages. If a provider integration cannot do so reliably, that is an explicit normalization gap to resolve in the provider feature's human-approved `spec.md`, not a false value to fabricate.

---

# 9. Message Model

Authoritative direction:

```ts
export interface Message {
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

Rules:

- `conversation` and `sender` are provider-supplied snapshots, not implicit network enrichment.
- `isOwn` is normalized convenience data and should remain auditable through account self-identity.
- `createdAt` is optional because some provider/event shapes may not supply it reliably.
- `receivedAt` is always stamped by Core at emit time.
- `raw` is diagnostics/escape-hatch data, not the normal rendering contract.
- `reactions`, when present, are a snapshot reported by the provider at that moment; Chatter does not maintain a live reaction store.

---

# 10. Reply and Thread

Reply and thread are separate concepts.

Never model:

```text
reply === thread
```

A reply may exist outside a thread.

A thread may be message-anchored or conversation-like depending on provider semantics.

Capability names describe what an application can do, not the provider endpoint shape.

For example:

```text
thread.create
```

means:

> a thread can be started from this message/context

even if the provider creates the thread implicitly through a reply operation.

---

# 11. Message Content

```ts
export interface MessageContent {
  text?: string;
  attachments: Attachment[];
  parts?: ContentPart[];
  extensions?: ProviderContent[];
}
```

`attachments` always exists.

## Attachments

Initial shared attachment categories:

- image
- video
- audio
- generic file
- sticker

A sticker is media with provider/rendering semantics and remains attachment-like.

## Structured content parts

Initial non-attachment content:

- location
- contact

A location/contact is not a file and should not be forced into `Attachment`.

## Provider extensions

Provider-specific structured content belongs in `extensions`.

Every provider-content value must have a stable provider-prefixed discriminant so consumers can register renderers without parsing `raw`.

Conceptual base:

```ts
export interface ProviderContent {
  provider: string;
  type: string; // e.g. "slack.block-kit", "whatsapp.interactive"
}
```

Provider packages may expose richer typed variants, but `provider` + `type` are stable discovery/rendering keys.

Examples:

- Slack Block Kit structures;
- WhatsApp interactive content;
- Telegram provider-specific markup/keyboards;
- Discord components.

Consumers must not parse `raw` for normal supported rendering.

## Open-union rule

The following consumer-facing extensible sets are governed by the open-union rule:

- `Attachment`;
- `ContentPart`;
- `ConversationType`;
- `AccountState`;
- `ChatterErrorCategory`;
- `Capability` / provider-contributed capability keys.

Consumers must implement an unknown/fallback branch for these extensible sets.

Known Core members should still receive strong autocomplete/types, but the public type must permit unknown future values without forcing an exhaustive consumer to break.

Provider-specific error **codes** are an open namespace independently of error categories.

Adding a new governed variant/category/key is therefore treated as an additive/minor change when the documented fallback contract is preserved.

---

# 12. Capability Model

Capabilities are application semantics.

Core examples:

```text
message.send
message.reply
message.edit
message.delete

reaction.add
reaction.remove

thread.create
thread.reply

attachment.image
attachment.video
attachment.audio
attachment.file
attachment.sticker
attachment.download

content.location
content.contact

typing.send
conversation.resolve
participant.resolve
message.fetch
conversation.history
```

Provider-specific keys use provider prefixes, for example:

```text
whatsapp.template.send
whatsapp.interactive.send
whatsapp.flow.send
```

Core capability keys are unprefixed.

The capability namespace is open so provider packages and third-party adapters can add keys without requiring a Core release for every provider feature.

## Typed registry

Conceptual TypeScript direction:

```ts
export interface CapabilityRegistry {
  "message.send": SendDescriptor;
  "message.edit": EditDescriptor;
  "attachment.image": AttachmentDescriptor;
  "reaction.add": ReactionDescriptor;
  "thread.reply": ThreadDescriptor;
}

export type Capability =
  | keyof CapabilityRegistry
  | (string & {});
```

Provider packages may extend `CapabilityRegistry` through TypeScript declaration merging.

Do not use one universal untyped metadata bag.

## Resolution

Capability resolution is:

- synchronous;
- pure;
- context-aware.

Scopes:

```text
account
conversation
message
```

No provider/network request may occur during `capabilities()`.

Provider policy or authorization failures that require a provider decision surface as errors, not capability mutations.

Capability resolution is independent of `AccountState`. A failed/reconnecting account may still report the semantics it supports; effective sendability is derived by applications from lifecycle health **plus** capability support, not by erasing capabilities while unhealthy.

Capability sets should expose a version/generation suitable for consumer memoization and should support identifying where a capability was narrowed when useful for diagnostics.

A `capabilities.changed` event invalidates consumer assumptions.

---

# 13. Public Operation Placement

Use a hybrid handle model.

`Chatter` owns:

- registration;
- lifecycle;
- events;
- account lookup;
- handle construction;
- convenience `send`;
- convenience `reply`.

Entity-targeted operations live on entity handles.

Conceptual direction:

```ts
class Chatter {
  use(adapter: ProviderAdapter): this;

  start(): Promise<StartResult>;
  stop(): Promise<void>;

  on(event, handler): Unsubscribe;

  accounts(): AccountHandle[];
  account(adapter): TypedAccountHandle;
  account(ref: ProviderAccountRef): AccountHandle;

  conversation(ref: ConversationRef): ConversationHandle;
  message(ref: MessageRef): MessageHandle;

  send(input: SendMessageInput): Promise<SentMessage>;
  reply(
    target: MessageRef | Message,
    content: OutgoingMessageContent
  ): Promise<SentMessage>;
}
```

`MessageHandle` is the home for operations such as:

- reply;
- edit;
- delete;
- react;
- unreact;
- thread access/create;
- fetch;
- attachment download.

`ConversationHandle` is the home for operations such as:

- send;
- typing;
- info/resolve;
- provider-backed history when supported.

Provider-specific operations remain on typed provider account handles:

```ts
wa.templates.send(...)
```

Handle construction should not require network I/O.


## SentMessage receipt semantics

`SentMessage` is a receipt, not necessarily a fully hydrated `Message`.

Its provider ref is optional:

```ts
export interface SentMessage {
  ref?: MessageRef;
  conversation: ConversationRef;
  createdAt?: Date;
  raw?: unknown;
}
```

If a provider accepts a send but does not return a stable message id, Chatter must not fabricate one and must not convert a successful provider operation into a failure merely to satisfy the ref model. Entity-targeted operations such as reply/reaction remain unavailable until a real `MessageRef` exists.

---

# 14. Lifecycle

Global transactional startup is **not** part of Chatter.

The superseded rule that one account failure stops all healthy accounts is deleted.

Account states:

```ts
type KnownAccountState =
  | "idle"
  | "starting"
  | "ready"
  | "reconnecting"
  | "failed"
  | "stopping"
  | "stopped";

type AccountState =
  | KnownAccountState
  | (string & {});
```

Use `ready`, not `connected`, because webhook-based providers may be operational without a persistent connection.

`degraded` is intentionally omitted until a real provider gives it a precise meaning.

State reasons may expose:

```ts
interface StateReason {
  code: string;
  message: string;
  retryAt?: Date;
}
```

## `start()`

Authoritative semantics:

- attempts every configured account;
- does not roll back healthy accounts;
- resolves after all configured accounts have reached an initial terminal startup state (`ready` or `failed`);
- during **initial startup**, an account that cannot reach `ready` must transition to `failed`; `reconnecting` is a post-startup recovery state and may not keep `start()` pending indefinitely;
- background reconnection may continue after `start()` resolves and surfaces through `account.state`;
- account failures are represented in the result rather than rejecting the whole startup;
- rejects only for pre-flight/configuration failures that prevent a valid startup attempt, such as duplicate account configuration;
- is idempotent.

Conceptual result:

```ts
interface StartResult {
  accounts: Array<{
    ref: ProviderAccountRef;
    state: AccountState;
    error?: ChatterError;
  }>;
}
```

Applications that want to become usable as soon as the first account is ready should subscribe to `account.state` rather than waiting for the returned Promise.

## `stop()`

`stop()` is idempotent.

Exact in-flight operation draining, timeout, and post-stop webhook behavior must be finalized in the lifecycle feature's human-approved `spec.md` and technical `plan.md` before implementation.

---

# 15. Event Model

Minimum common event namespace:

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

Rules:

- one handler failure must not prevent other handlers;
- handler failures surface through normalized runtime error handling;
- event delivery/concurrency/backpressure semantics must be specified before the common event runtime is implemented;
- Chatter does not maintain reaction state; consumers aggregate reaction events if they need live state;
- message/reaction snapshots may be present when the provider supplies them in the same payload.

Provider-specific events stay on typed provider handles.

Example:

```ts
wa.on("message.status", ...)
```

WhatsApp delivery/read status remains provider-specific.

A generic diagnostics event tap may exist, but if exposed it must be explicitly documented as diagnostics-grade and outside normal compatibility/performance guarantees.

---

# 16. Media Retrieval

Media retrieval is a genuinely shared transport problem.

Browsers must not receive provider credentials or raw authenticated provider URLs.

Use a common, capability-gated operation that retrieves media without storing it.

Conceptual result:

```ts
interface MediaContent {
  stream: ReadableStream<Uint8Array>;
  mimeType: string;
  size?: number;
  filename?: string;
}
```

Rules:

- no Core media database;
- no re-hosting;
- no persistent caching;
- no provider-authenticated URL in the common browser-facing model;
- provider media expiry maps to a normalized condition;
- size/type limits belong in typed capability descriptors.

---

# 17. Error Model

Error classes remain ergonomic, but the stable machine-readable contract is the error code/category.

Conceptual base:

```ts
abstract class ChatterError extends Error {
  readonly code: string;
  readonly category: ChatterErrorCategory;

  readonly retryable?: boolean;
  readonly retryAfterMs?: number;

  readonly provider?: string;
  readonly accountId?: string;
  readonly operation?: string;
  readonly correlationId?: string;

  toJSON(): SerializedChatterError;
}
```

Use the standard ES `Error.cause`; do not redeclare a competing `cause` field.

`ChatterErrorCategory` is an open consumer-facing category set governed by the open-union rule. Consumers must handle unknown future categories.

Core categories include:

- AuthenticationError
- PermissionError
- RateLimitError
- InvalidRequestError
- UnsupportedCapabilityError
- MessageDeliveryError
- ProviderPolicyError
- ProviderUnavailableError
- ConfigurationError
- UnknownProviderAccountError
- DuplicateProviderAccountError
- UnknownProviderError / equivalent fallback

## Serialization

Across JSON boundaries:

- switch on `code`, not `instanceof`;
- `toJSON()` excludes `cause` by default;
- provider HTTP objects and authorization headers must never be serialized to browser clients;
- diagnostics serialization requires explicit redaction.

Core codes are stable and unprefixed.

Provider-specific codes are prefixed/namespaced.

---

# 18. WhatsApp Customer-Service Window

Frozen decision:

**Chatter does not persist, cache, or maintain conversation history to calculate the WhatsApp customer-service window.**

Chatter attempts a semantically valid free-form send.

Meta remains authoritative.

If Meta refuses because the customer-service window is closed, the WhatsApp adapter normalizes the provider error.

Use:

```text
category: ProviderPolicyError
code: WHATSAPP_CUSTOMER_SERVICE_WINDOW_EXPIRED
retryable: false
cause: original provider error
```

Do **not** put `recovery: send-template` in Core.

The provider-specific application/UI may recognize the code and offer its template workflow.

Do not map this condition by provider error message text. Map by stable provider error code/structure.

The mapping belongs at the common WhatsApp provider-error mapping layer so text, media, reply, and interactive sends receive consistent behavior.

Applications that already persist their own history may proactively predict the window state. That remains outside Chatter.

---

# 19. Adapter SPI

`ProviderAdapter` / `ProviderContext` must be specified before provider implementation.

Minimum responsibilities:

```ts
interface ProviderAdapter {
  readonly provider: string;
  readonly accountId: string;

  init(ctx: ProviderContext): void | Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  capabilities(context: CapabilityContext): CapabilitySet;

  send(input: NormalizedSendInput): Promise<SentMessage>;

  readonly self?: Participant;
  readonly native: unknown;

  // capability-correlated optional operations
  edit?: unknown;
  delete?: unknown;
  react?: unknown;
  unreact?: unknown;
  threadReply?: unknown;
  typing?: unknown;
  fetchMessage?: unknown;
  history?: unknown;
  downloadMedia?: unknown;
  resolveConversation?: unknown;
  resolveParticipant?: unknown;
}
```

Exact method signatures belong in the Adapter SPI feature's human-approved `spec.md` and technical `plan.md`.

## SPI rules

1. inbound normalization is pure and synchronous;
2. adapters use Core-provided ref factories rather than hand-assembling account/provider refs;
3. Core stamps `receivedAt`;
4. adapters own provider-error normalization;
5. capability declaration and optional operation support must be mechanically consistent;
6. the SPI is internal-but-stable because `@chatter/testing` is intended to support third-party adapters.

`ProviderContext` must at least provide:

- bound account ref;
- abort signal;
- injectable logger;
- injectable clock;
- ref factory;
- normalized emit surface for common events;
- provider-event emission surface;
- account-state/capability-change/error emission.

---

# 20. Webhook Boundary

Webhook support must remain framework-neutral.

Core provides request/response types roughly equivalent to:

```ts
interface WebhookRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody: Uint8Array;
  query: Record<string, string | undefined>;
}

interface WebhookResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}
```

Raw bytes are required for provider signature verification.

Runtime-level webhook routing must support multiple accounts under a provider integration.

Provider-specific features must define routing keys and verification behavior in their human-approved `spec.md`.

No Express/Fastify dependency in Core.

---

# 21. Testing Strategy

Order:

```text
approved spec
→ failing unit/contract test
→ implementation
→ provider integration test
→ Bruno acceptance
→ E2E where justified
```

The contract framework therefore exists before lifecycle/outbound implementation.

Required testing areas include:

- entity identity/ref round trips;
- cross-account isolation;
- lifecycle partial-start isolation;
- shutdown with in-flight work;
- subscribe/unsubscribe leak checks;
- event ordering/concurrency semantics;
- webhook redelivery;
- handler backpressure;
- token expiration transitions;
- media expiration;
- missing `createdAt`;
- contextual capability differences;
- error serialization/redaction;
- WhatsApp policy-window mapping;
- capability declaration ↔ method/contract consistency.

---

# 22. Fake Provider

`@chatter/testing` includes configurable fake-provider profiles.

Do not ship one universal "supports everything" fake.

Initial conceptual profiles:

```text
minimal
rich
polling
gateway
```

Profiles should emulate meaningful provider-shaped constraints rather than defining universal semantics.

The fake must support hostile scenarios:

- duplicate events;
- out-of-order events;
- missing timestamps;
- missing display names;
- token expiry;
- media expiry;
- lifecycle failures;
- capability changes;
- slow/hanging stop;
- unsupported operations.

The fake:

- is testing-only;
- is not evidence of real-provider support;
- never appears as capability-matrix proof;
- never substitutes for provider integration testing.

---

# 23. Cross-Provider Core Freeze Gate

Before implementing the WhatsApp adapter against frozen Core contracts:

1. complete a written cross-provider mapping against WhatsApp, Slack, Telegram, and Discord;
2. pressure-test at least Slack and Telegram semantics explicitly;
3. run Core contract suites against the fake profiles;
4. resolve any Core-shape contradiction;
5. freeze Core public contracts;
6. then continue strict provider depth-first implementation.

This is architecture validation, not Slack/Telegram feature implementation.

---

# 24. WhatsApp V1

In scope:

## Messaging

- text;
- reply;
- image;
- video;
- audio;
- file;
- sticker;
- reaction;
- location;
- contact.

## Media

- upload;
- download/retrieval.

## Events

- incoming messages;
- reactions;
- sent/delivered/read/failed status through WhatsApp-specific events;
- interactive replies;
- Flow responses.

## Provider-specific public APIs

- templates;
- interactive messages;
- basic Flow messaging.

## Infrastructure

- webhook verification;
- webhook handling;
- multi-account routing;
- normalized errors;
- native escape hatch.

Out of scope:

- calling;
- payments;
- commerce/catalog administration;
- WABA administration;
- phone-number administration;
- 2FA;
- registration;
- QR management;
- group administration;
- full Flow administration;
- marketing-management APIs.

---

# 25. Definition of Done

## Adapter-complete

A provider adapter is adapter-complete when:

- V1 scope is implemented;
- applicable contract suites pass;
- unit normalization/validation/error tests pass;
- real-provider integration tests pass where practical;
- primary E2E paths are validated;
- lifecycle behavior is correct;
- capability matrix is accurate;
- errors are normalized;
- `raw` and `native` escape hatches behave as documented;
- Bruno/provider acceptance coverage passes;
- public docs/examples are complete;
- no claimed capability is incomplete.

## Reference-implementation complete

Additionally:

- stable user-interactable capabilities have example-client coverage or documented exclusion;
- provider-specific stable interactive APIs have appropriate example-client extensions;
- example-client capability-coverage checks pass.

A project milestone may require both, but adapter completion should remain distinguishable from full reference-application completion.


# 25A. Privacy / Observability Precision

Canonical refs are stable identity tools, not safe log strings.

Default logs should keep `provider`, Chatter `accountId`, normalized `code`, operation name, and `correlationId` in clear where appropriate, while redacting/hashing provider-native `id` and `conversationId`.

`correlationId` is created by Core at a logical operation or inbound-event boundary and propagated through descendant errors/events/log records for that chain.

Serialized errors received in environments without provider packages must deserialize to a generic remote/serialized Chatter error that preserves `code`, `category`, and safe metadata without requiring provider-specific classes.

---

# 26. Versioning

SemVer with independent package versions.

Provider SDK changes do not require Chatter major versions when fully absorbed internally.

`native` and `raw` are explicit compatibility exclusions: their provider-native contents may change with provider SDK/API changes even when the stable Chatter wrapper does not.

Adding a governed open-union member (`Attachment`, `ContentPart`, `ConversationType`, `AccountState`, `ChatterErrorCategory`, or capability key) is a minor change only under the documented consumer fallback obligation.

Current 1.0 target:

- stable Core;
- complete WhatsApp V1;
- complete Slack V1;
- real-world dogfooding;
- no unresolved Core contract issues.

Slack V1 scope must be defined before 1.0 becomes a release gate.

---

# 27. Decisions SpecMan Features Must Not Reopen Casually

- strict provider order;
- WhatsApp-first depth-first implementation;
- Core/provider SDK isolation;
- Conversation rather than Channel as universal abstraction;
- provider-native ids;
- `MessageRef.conversationId`;
- reply/thread separation;
- no implicit I/O during normalization;
- semantics vs authorization capability rule;
- synchronous pure capability resolution;
- open capability namespace;
- typed capability descriptors;
- structured provider-specific content rather than normal `raw` parsing;
- no Chatter conversation persistence;
- per-account lifecycle instead of global rollback;
- `ready` account state naming;
- no `degraded` until a real semantic exists;
- common media retrieval without media storage;
- stable serialized error codes;
- WhatsApp 24h window handled as `ProviderPolicyError`, not Chatter-maintained history;
- contract-first TDD;
- fake provider as testing aid, not provider truth;
- mandatory cross-provider Core freeze gate;
- example client uses Chatter only.

A feature whose human-approved `spec.md` genuinely conflicts with one of these must flag an architectural conflict rather than silently changing it. Resolve the conflict with a human and update the relevant architectural record before implementation proceeds.

---

# 28. Still Deferred Intentionally

Feature-level SpecMan planning may still decide:

- exact descriptor contents beyond the currently needed families;
- history pagination APIs;
- provider-specific API ergonomics;
- example-client HTTP/realtime transport;
- reconnect backoff numbers and maximum attempts;
- manual retry API details;
- event concurrency/backpressure exact guarantees;
- stop/drain timeout behavior;
- optional future provider-container domain model (workspace / guild / equivalent);
- diagnostics tap internals;
- streaming attachment *sources*;
- provider implementation details that do not affect public contracts;
- provider-native read-state capability (client G9), until a real provider feature's `spec.md` requires it.
