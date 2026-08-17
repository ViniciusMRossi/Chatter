# Phase 1 Data Model: Core Package Foundation

All identifiers are opaque strings at the type level (branded types considered and deferred —
see Open Decision #4 in the roadmap; plain `string` aliases are used this phase to avoid
over-committing before a real adapter proves the ergonomics).

## Reference keys

Composed exactly as specified in the product requirements doc §6:

```text
AccountKey      = `${provider}:${providerAccountId}`
ParticipantKey  = `${provider}:${providerAccountId}:${providerParticipantId}`
ConversationKey = `${provider}:${providerAccountId}:${providerConversationId}`
ThreadKey       = `${ConversationKey}:${providerThreadId}`
```

These are derived/computed, not separately stored fields — they exist so an application can use
them as map/database keys without Chatter prescribing a storage mechanism.

## Entities

### Provider
- `name: string` — e.g. `"fake"` this phase; `"slack" | "telegram" | ...` in later phases. Not
  an enum yet (extensibility per constitution Principle II — a third-party provider name must
  not require a core code change).

### Account
- `provider: string`
- `providerAccountId: string` — opaque, provider-scoped.
- `accountName: string` — the unique application-level name from FR-001/FR-002.
- `capabilities: ReadonlySet<Capability>` — declared, queryable per FR-007.

Validation: `accountName` uniqueness enforced by the orchestrator at registration time (FR-002),
not by the `Account`/adapter type itself.

### Participant
- `provider: string`
- `providerAccountId: string`
- `providerParticipantId: string`
- `displayName?: string`

No cross-provider identity field exists anywhere in this type — enforces constitution Principle
I / requirements §6 rule 4 structurally, not just by convention.

### Conversation
- `provider: string`
- `providerAccountId: string`
- `providerConversationId: string`
- `type: "direct" | "group" | "channel" | "unknown"` (FR-004, requirements FR-007)
- `providerThreadId?: string`

### Message
- `id: string` — stable provider message ID (FR-004, requirements FR-013).
- `provider: string`
- `account: string` — the application-level account name.
- `sender: Participant`
- `conversation: Conversation`
- `text: string`
- `createdAt: Date`
- `replyToMessageId?: string`

### Event (this phase: one variant)
- `type: "message.created"`
- `account: string`
- `message: Message`

Modeled as a discriminated union (`type` as discriminant) even with one variant this phase, so
adding `message.edited` etc. in Phase 5 is additive, not a breaking change to existing
consumers' `switch`/narrowing code.

### Capability
- A string literal union this phase: `"text" | "reply" | "thread"`. `"reply"` = can target a
  prior message without necessarily nesting into a provider thread construct; `"thread"` = can
  address a distinct thread reference (`providerThreadId`). Kept as a closed union (not a bare
  `string`) so the fake account can be deliberately built with `"thread"` absent, satisfying
  Story 3's capability-query acceptance scenario without needing a real provider's partial
  feature set to demonstrate the concept.

### DeliveryResult
- `provider: string`
- `account: string`
- `providerMessageId: string`
- `conversation: Conversation`
- `timestamp?: Date` — optional per FR-006 ("when available").
- `raw?: unknown` — opt-in raw provider metadata (constitution Principle VI raw-payload rule);
  unused by the fake account this phase but part of the type from the start so real adapters
  don't need a breaking type change to populate it.

### Errors (see research.md decision)
- `ChatterError` (abstract base): `message: string`, `cause?: unknown`.
- `ChatterConfigurationError` — e.g. duplicate `accountName` (FR-002).
- `ChatterAuthenticationError`
- `ChatterAuthorizationError`
- `ChatterRateLimitError` — adds `retryable: true`, `retryAfterMs?: number`.
- `ChatterInvalidTargetError` — e.g. send to unknown conversation/message id.
- `ChatterUnsupportedCapabilityError` — e.g. thread-targeted send on an account without
  `"thread"`.
- `ChatterProviderUnavailableError` — adds `retryable: boolean`.
- `ChatterUnknownError` — catch-all, wraps an unexpected `cause`.

Authentication/authorization errors have no simulable trigger via the fake account in this phase
(no real credentials exist yet) — their types are still defined now so the error hierarchy is
complete and stable before any real adapter needs to throw them.

## Adapter contract (implemented by the fake account this phase)

- `getCapabilities(): ReadonlySet<Capability>`
- `start(): Promise<void>`
- `stop(): Promise<void>`
- `send(input: { conversation: Conversation; text: string; replyToMessageId?: string }): Promise<DeliveryResult>`
- Emits inbound events by calling a dispatch callback supplied by the orchestrator at
  registration time (kept as a plain callback between adapter and orchestrator internally, even
  though the orchestrator's own public surface to the *application* is the `EventEmitter` from
  research.md — these are two different, deliberately separate interfaces).

## State transitions (orchestrator lifecycle)

`created → started → stopped`. `started → started` (double start) and `stopped → stopped`
(double stop) are no-ops, not errors (Edge Cases section of spec.md). Sends attempted in
`created` or `stopped` state throw `ChatterConfigurationError` (not silently queued) per Story 1
Acceptance Scenario 3. Events dispatched by an adapter while the orchestrator is in `stopped`
state are dropped, not queued or delivered late.
