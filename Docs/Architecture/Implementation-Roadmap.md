# Chatter — Implementation Roadmap

## Status

**Architecture-frozen implementation roadmap, aligned to SpecMan**

This document preserves the accepted Chatter implementation ordering and technical milestones. It replaces prior Chatter SDD-plan documents as a **product roadmap**, not as a competing development workflow. Superseded architectural rules such as globally transactional startup and account-level-only capability resolution remain intentionally removed.

Implementation must not begin against an older Chatter SDD-plan copy.

---

## 1. Relationship to SpecMan

SpecMan owns the reusable development workflow. This roadmap owns Chatter-specific sequencing, deliverables, contracts, and acceptance expectations.

A roadmap phase is **not automatically one SpecMan feature**. Decompose each phase into one or more independently verifiable features. By default, one meaningful feature maps to one SpecMan feature branch and one PR.

For each meaningful feature, follow the repository's SpecMan workflow. Feature Planning may produce a non-canonical Feature Planning Brief; Spec Kit then establishes the canonical feature `spec.md`, technical `plan.md`, and execution `tasks.md`, with human approval gates before implementation as defined by SpecMan.

Chatter adds one project-specific refinement to SpecMan TDD: when behavior belongs to a reusable Chatter contract suite, the RED phase should begin with the corresponding failing contract test whenever practical. Contract tests define Chatter semantics; SpecMan defines how RED/GREEN/refactor evidence is recorded.

The implementation agent must stop and flag any contradiction between a human-approved feature `spec.md` / `plan.md` and the Chatter constitution, Core Contract, or other frozen architectural decisions. No feature artifact may silently override project architecture.

---

## 2. Phase 0 — Chatter Repository Foundation

SpecMan must initialize the repository before or as part of Phase 0. Do **not** reimplement SpecMan-owned infrastructure in Chatter planning. In particular, the base dev container, `AGENTS.md`, `.sdd/`, Spec Kit lifecycle files, workflow checks, handoff/dev-log mechanics, Git/PR conventions, and baseline CI/security controls come from SpecMan. Chatter may configure or extend them where the product requires it.

Create/validate the Chatter-owned repository structure:

```text
packages/core
packages/testing
packages/whatsapp
packages/slack
packages/telegram
packages/discord

apps/validation-server
apps/example-client

bruno
Docs
```

Decide and document:

- package manager and workspace configuration;
- TypeScript target/lib baseline, including native `Error.cause` and Web `ReadableStream<Uint8Array>` support required by `MediaContent`;
- package build/test/lint/typecheck commands;
- independent package versioning;
- per-package Node engine requirements;
- workspace boundaries;
- no production dependency from provider packages to `@chatter/testing`.

Configure the SpecMan-generated `.sdd/commands.env` with the real Chatter build, lint, typecheck, unit-test, integration-test, and full-verification commands once those commands exist. Extend the SpecMan CI baseline with Chatter-specific contract, Bruno, provider, and E2E jobs rather than creating a parallel CI framework.

Deliverable: a buildable empty Chatter monorepo whose project-specific verification runs successfully through the SpecMan verification surface.

---

## 3. Phase 1 — Core Public Model and Adapter SPI

This phase freezes the load-bearing public/SPI shapes before provider work.

### 3.1 Entity refs

Implement:

```ts
ProviderAccountRef
ConversationRef
ParticipantRef
MessageRef { conversationId, id, ...account }
ThreadRef { conversationId, id, ...account }
```

Also implement:

- canonical `formatRef` / `parseRef` or equivalent;
- `conversationRefOf(messageRef)`;
- account-bound `RefFactory`.

Contract requirements:

- JSON round-trip;
- cross-account isolation;
- refs remain sufficient operation targets;
- no provider-specific mapping table required merely to resolve a ref.

### 3.2 Common snapshots

Implement:

```ts
Conversation
Participant
Message
```

with:

```text
Message.conversation: Conversation
Message.sender: Participant
Message.isOwn
Message.createdAt?
Message.receivedAt
```

Core stamps `receivedAt`.

No implicit enrichment I/O.

Ownership must be deterministic: an adapter must never emit `isOwn: false` merely because `self` was unavailable. Successful adapter startup must establish enough self/author identity to classify every normalized message it emits, or the provider feature's human-approved `spec.md` must explicitly resolve the gap.

### 3.3 Content model

Freeze the governed open-union policy for:

```text
Attachment
ContentPart
ConversationType
AccountState
ChatterErrorCategory
Capability
```

Consumers must implement unknown/fallback handling and versioning must mirror this rule.

Implement:

```text
MessageContent.text
MessageContent.attachments[]
MessageContent.parts[]
MessageContent.extensions[]
```

Initial types:

```text
attachments: image, video, audio, file, sticker
parts: location, contact
```

`ProviderContent` must have stable `provider` and provider-prefixed `type` discriminants in Phase 1. Rich provider-specific payload typing may live in provider packages.

Document open-union fallback semantics.

### 3.4 Capability registry

Implement open, typed registry mechanism with provider extension support.

Requirements:

- core keys unprefixed;
- provider keys prefixed;
- declaration-merging or equivalent typed extension mechanism;
- synchronous pure resolution;
- resolution independent of lifecycle `AccountState`;
- account/conversation/message contexts;
- typed descriptors;
- capability-set version/generation;
- diagnostics narrowing information if approved in the feature `spec.md`.

### 3.5 Operation/handle model

Freeze and implement public handles:

```text
Chatter
AccountHandle
TypedAccountHandle
ConversationHandle
MessageHandle
ThreadHandle as required
```

Rules:

- Chatter keeps `send` and `reply` conveniences;
- entity-targeted operations live on entity handles;
- provider-specific APIs stay on typed provider handles;
- `reply()` accepts `MessageRef | Message`;
- handle construction performs no implicit provider I/O.

### 3.6 Error contract

Implement stable serializable errors:

```text
code
category
retryable?
retryAfterMs?
provider?
accountId?
operation?
correlationId?
cause via Error.cause
```

Include `ProviderPolicyError`.

Implement safe `toJSON()` and deserialization.

`cause` excluded from normal JSON by default.

### 3.7 Adapter SPI

Feature-spec and implement:

```text
ProviderAdapter
ProviderContext
RefFactory
CapabilityContext
normalized emit surface
framework-neutral WebhookRequest/WebhookResponse types
```

SPI invariants:

- no implicit normalization I/O;
- refs created through bound factory;
- Core stamps receive time;
- adapter maps provider errors;
- capability declarations correlate mechanically with operations;
- SPI is internal-but-stable.


### 3.8 Common event-name freeze

Freeze the common event names in Phase 1 because the Phase 2 harness and ProviderContext emit surface depend on them:

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

Phase 4 specifies runtime ordering/concurrency/backpressure semantics; it does not rename this set.

---

## 4. Phase 2 — Contract Testing Foundation and Fake Provider

This phase occurs **before lifecycle and outbound implementation**.

Create reusable contract harness capable of:

- constructing an adapter;
- supplying a controlled ProviderContext;
- observing emitted events;
- simulating provider results;
- testing capability declarations;
- testing lifecycle transitions;
- testing error mapping.

Create fake-profile **skeletons**:

```text
minimal
rich
polling
gateway
```

Their behavior grows as the corresponding Core subsystems are implemented in later phases. Phase 2 does not pretend to implement lifecycle/event behavior before those runtimes exist.

No superset/default "everything provider".

Add hostile-mode controls:

- duplicate events;
- out-of-order events;
- missing createdAt;
- missing display names;
- media expiry;
- capability changes;
- token expiry;
- start failure;
- reconnect;
- slow/hanging stop.

Meta-rule:

> A contract suite is not externally validated until at least one real provider adapter passes it.

---

## 5. Phase 3 — Lifecycle

Implement per-account lifecycle.

States:

```text
idle
starting
ready
reconnecting
failed
stopping
stopped
```

No `degraded`.

Implement:

```ts
start(): Promise<StartResult>
stop(): Promise<void>
account.state events
```

Startup rules:

- attempt all configured accounts;
- healthy accounts are never rolled back because another failed;
- account failures are represented in `StartResult`;
- during initial startup, an account that cannot reach `ready` transitions to `failed`; `reconnecting` is post-startup only and may not keep `start()` pending indefinitely;
- background reconnection may continue after `start()` resolves through `account.state`;
- reject only pre-flight/configuration failures;
- idempotent.

Required contracts:

```text
partial startup isolation
start settles for minimal/rich/polling/gateway profiles under initial start failure
```

There is **no** `startup rollback` contract.

The feature's human-approved `spec.md` and technical `plan.md` must finalize before implementation:

- reconnect backoff policy;
- terminal failure criteria;
- whether `retryNow()` exists;
- in-flight behavior during stop;
- post-stop webhook status behavior.

---

## 6. Phase 4 — Event Runtime

Implement common event names:

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

Define before coding:

- ordering guarantee within one adapter/account/conversation;
- whether handlers run concurrently;
- backpressure behavior;
- webhook acknowledgement interaction;
- unhandled-error behavior;
- unsubscribe/listener cleanup.

Provider-specific event namespace remains on typed handles.

Add diagnostics tap only if its compatibility/performance status is explicitly documented.

---

## 7. Phase 5 — Outbound Core

Implement:

- Chatter `send`;
- Chatter `reply`;
- ConversationHandle send;
- MessageHandle reply/edit/delete/react/unreact/thread operations as capability-gated operations;
- local semantic validation;
- cross-provider/account reference validation;
- stable `SentMessage`.

Rules:

- no empty send;
- no silent semantic downgrade;
- unsupported semantics fail before provider SDK invocation;
- authorization/policy rejection may still happen after semantic capability validation;
- no automatic retry of state-changing sends.

Define `SentMessage` as a send receipt. `ref?: MessageRef` is optional because Chatter must not fabricate an id or turn an accepted provider send into a failure when a provider does not return a stable id. Entity-targeted operations remain unavailable until a real ref exists. Document echo reconciliation separately.

---

## 8. Phase 6 — Media Retrieval

Implement shared capability:

```text
attachment.download
```

and a streaming `MediaContent` result.

Rules:

- no persistence;
- no re-hosting;
- no browser-facing provider-authenticated URLs;
- explicit media-expired normalized result/error;
- descriptor carries relevant limits.

Outbound attachment sources remain:

```text
url
path
Uint8Array
```

Streams as outbound source remain deferred.

---

## 9. Phase 7 — Validation Server Foundation

Build the validation server now, before provider breadth increases.

It must:

- instantiate Chatter as an external consumer;
- expose only stable implemented Chatter behavior;
- never import provider SDKs directly;
- serialize Chatter errors through the stable error contract;
- expose bounded test-observation facilities for asynchronous acceptance scenarios.

Endpoint names are examples, not frozen architecture. Routes follow the public API rather than defining it.

At this phase, create a **minimal Bruno acceptance collection** against the fake provider and grow it incrementally with each subsequent feature. Phase 20 is acceptance completion, not the first construction of the acceptance layer.

Also stand up a narrow example-client conformance slice against the `rich` fake profile (timeline + message-scope capability resolution) early enough to exercise synchronous capability resolution under realistic list load. This is not full client completion.

---

## 10. Core Freeze Gate

Before WhatsApp implementation proceeds against frozen Core:

### 10.1 Written provider mapping

Complete and approve:

```text
Docs/Chatter-Cross-Provider-Core-Mapping.md
```

for WhatsApp, Slack, Telegram, Discord.

### 10.2 Paper pressure test

Explicitly validate at minimum:

- MessageRef;
- Conversation;
- Participant;
- self identity;
- thread shapes;
- edit/delete;
- reactions;
- media retrieval;
- capability descriptors;
- lifecycle states;
- provider container concepts;
- provider event differences.

### 10.3 Fake-provider pressure tests

Pass Core contracts against profiles that exercise semantics WhatsApp does not.

### 10.4 Freeze

Resolve all cross-provider Core contradictions before Phase 8.

This does not count as Slack/Telegram/Discord feature implementation.

---

## 11. Phase 8 — WhatsApp Driver Layer

Implement:

```text
WhatsAppAdapter
→ WhatsAppDriver
→ MetaCloudApiDriver
→ meta-cloud-api
```

The driver interface is provider-API-shaped, not library-ergonomics-shaped.

Main adapter contract tests mock `WhatsAppDriver`, not `meta-cloud-api`.

MetaCloudApiDriver has its own driver integration tests.

---

## 12. Phase 9 — WhatsApp Configuration / Auth / Webhook

Implement:

- account configuration;
- auth validation;
- framework-neutral webhook verification;
- raw-body signature verification **before trusting payload fields for routing**;
- multi-account routing;
- inbound payload fan-out.

The runtime owns the webhook mount/routing surface.

The provider adapter owns provider payload parsing and normalized emission.

Provider credentials never reach browser/client code.

Accounts belonging to different Meta apps require distinct trusted webhook paths/configurations when the signing secret cannot be selected safely before verification.

---

## 13. Phase 10 — WhatsApp Inbound Messaging

Normalize:

- text;
- sender snapshot;
- conversation snapshot;
- `isOwn`;
- provider timestamp where present;
- Core receive time;
- `raw`.

Preserve stable ids and conversationId in MessageRef.

Add webhook redelivery tests.

---

## 14. Phase 11 — WhatsApp Outbound Text / Reply

Implement:

- free-form text;
- reply;
- normalized SentMessage;
- semantic validation.

### Customer-service window

Do not persist `lastInboundAt`.

Attempt semantically valid provider send.

Map the provider's stable error code/structure for an expired customer-service window at the shared WhatsApp error-mapping layer to:

```text
ProviderPolicyError
code = WHATSAPP_CUSTOMER_SERVICE_WINDOW_EXPIRED
retryable = false
```

Do not include Core recovery instructions.

Do not map by human-readable provider error string.

Add a positive integration/acceptance path demonstrating that template sending remains available when free-form sending is refused by policy, where test infrastructure permits it.

---

## 15. Phase 12 — WhatsApp Media and Sticker

Split into independently verifiable SpecMan features where appropriate:

- image;
- video;
- audio;
- file;
- sticker;
- upload;
- retrieval/download;
- media expiry.

Use the shared content/media contracts.

---

## 16. Phase 13 — WhatsApp Reactions

Implement:

- outbound add/remove reaction;
- inbound reaction events;
- provider reaction constraints descriptor.

Chatter emits reaction events and does not maintain a live reaction map.

---

## 17. Phase 14 — WhatsApp Location and Contact

Implement structured `ContentPart` receive/send for:

- location;
- contact.

Do not encode them through `raw`.

---

## 18. Phase 15 — WhatsApp Status Events

Implement provider-specific typed-handle events:

```text
sent
delivered
read
failed
```

Do not promote these into a universal common status model.

Provider-specific ordered progressions may be documented without implying a cross-provider ordering.

---

## 19. Phase 16 — WhatsApp Interactive Messages

Implement the approved stable WhatsApp interactive API.

Structured inbound/outbound provider content must use provider extensions, not consumer `raw` parsing.

---

## 20. Phase 17 — WhatsApp Templates

Implement typed provider-specific template API.

Example client may use the stable customer-service-window error code to offer the provider-specific template workflow.

Core does not prescribe this recovery.

---

## 21. Phase 18 — WhatsApp Basic Flows

Implement only the approved basic Flow messaging scope.

Full Flow administration remains out of scope.

---

## 22. Phase 19 — WhatsApp Hardening

Cover:

- auth expiry;
- provider errors;
- rate limits;
- unknown provider codes;
- retries for safe/idempotent operations only;
- no automatic retry for state-changing sends;
- duplicate webhooks;
- malformed payloads;
- handler failures;
- slow handlers;
- shutdown in-flight behavior;
- media expiry;
- account isolation.

---

## 23. Phase 20 — Bruno Acceptance Completion / Hardening

### PR CI extension

Extend the SpecMan PR CI baseline with credential-free acceptance against fake provider profiles.

### Protected provider job

Run WhatsApp-specific live acceptance with protected credentials where feasible.

### Provider-initiated events

For parser/webhook acceptance, Bruno may POST synthetic Meta payloads through Chatter's **real public webhook handler** and then query the validation server's bounded observation surface.

Synthetic injection must never bypass Chatter's public webhook seam.

Real provider integration tests remain responsible for validating actual Meta behavior.

---

## 24. Phase 21 — Example Client Coverage

The example client is developed alongside stable capabilities, but full application QA is not allowed to redefine adapter semantics.

Required:

- shared UI for common stable interactive capabilities;
- provider extensions for WhatsApp-specific stable capabilities;
- capability inspector;
- diagnostics;
- account-state UI;
- media retrieval through server/Chatter;
- no provider SDK calls from the browser;
- no Chatter conversation persistence introduced for UI convenience;
- the frozen client's conceptual `degraded` row is documented as unreachable in Chatter V1 unless a future Core state gives it real semantics; do not invent a fake state merely to exercise that row.

---

## 25. Phase 22 — WhatsApp Adapter Completion

Adapter-complete DoD:

- all WhatsApp V1 adapter scope implemented;
- contract/unit/integration tests pass;
- primary E2E paths validated;
- Bruno/provider acceptance passes;
- docs/examples complete;
- capability matrix accurate;
- no SDK types leak into Core;
- native/raw documented;
- rate-limit/retry behavior documented;
- no unresolved adapter DoD item.

Reference-implementation completion is tracked separately and additionally requires example-client interactive coverage.

---

## 26. Slack, Telegram, Discord

Only after WhatsApp adapter completion:

```text
Slack
→ complete

Telegram
→ complete

Discord
→ complete
```

Before Slack begins, define Slack V1 scope at the same granularity as WhatsApp V1.

Do not use the fake provider as evidence of provider support.

---

## 27. Core Contract Suites

At minimum:

```text
providerLifecycleContract
partialStartupIsolationContract
incomingMessageContract
entityIdentityContract
conversationSnapshotContract
participantSnapshotContract
selfIdentityContract
sendTextContract
replyContract
messageEditContract
messageDeleteContract
attachmentImageContract
attachmentVideoContract
attachmentAudioContract
attachmentFileContract
attachmentStickerContract
attachmentDownloadContract
locationContentContract
contactContentContract
reactionAddContract
reactionRemoveContract
threadCreateContract
threadReplyContract
typingSendContract
conversationResolveContract
participantResolveContract
messageFetchContract
conversationHistoryContract
capabilityDeclarationContract
contextualCapabilityContract
unsupportedCapabilityContract
errorNormalizationContract
errorSerializationContract
runtimeErrorContract
crossAccountIsolationContract
unsubscribeContract
```

Provider-specific suites cover provider-specific APIs/events.

---

## 28. Versioning Rules

Independent SemVer packages.

Core public contract changes follow SemVer.

Provider SDK changes are absorbed internally where possible.

Provider-specific `native` values and entity `raw` payload contents are compatibility exclusions.

Additions to governed open sets (`Attachment`, `ContentPart`, `ConversationType`, `AccountState`, `ChatterErrorCategory`, capability keys) are minor only because consumer fallback behavior is mandatory.

Core capability namespace remains extensible.

---

## 29. Documentation Required Before First Public Release

- Core public API reference;
- adapter SPI reference;
- capability naming/descriptor guide;
- lifecycle semantics;
- event semantics;
- error serialization/security rules;
- media retrieval rules;
- webhook mounting/routing examples;
- provider account identity/ref format;
- cross-provider mapping;
- testing contract guide;
- fake-provider limitations;
- retry policy;
- privacy/logging posture.

---

## 30. Observability

Provide an injectable logger through ProviderContext/runtime configuration.

Default library behavior must not log message content, access tokens, authorization headers, or raw provider payloads.

Refs may contain personal provider-native identifiers (for example WhatsApp phone numbers). Structured diagnostics must **not** log canonical refs verbatim by default. Prefer provider + Chatter accountId + normalized code + operation + correlationId, and redact/hash `id` / `conversationId`.

Core generates `correlationId` at a logical public-operation or inbound-event boundary and propagates it through descendant events/errors/log records for that chain.

Error deserialization in a browser/process without provider packages yields a generic remote Chatter error preserving safe `code`, `category`, and metadata; it must not require provider-specific classes.

---

## 31. Final Non-Negotiable Rules

These are Chatter project rules. They complement the SpecMan workflow and must not be weakened by feature-level artifacts without explicit human architectural approval.

- No provider SDK imports in Core.
- No hidden Chatter conversation database.
- No implicit network enrichment during normalization.
- Capability resolution is synchronous/pure.
- Capability support does not promise provider authorization.
- No silent semantic downgrade.
- No automatic retry of state-changing sends.
- No global rollback because one account fails.
- No provider credentials in browser code.
- No raw provider URLs as common media transport.
- No provider-error message-text matching when a stable code exists.
- No fake-provider evidence substituted for real-provider validation.
- No Core freeze before written cross-provider mapping review.
- No canonical provider-native refs in default logs without redaction/hashing.
