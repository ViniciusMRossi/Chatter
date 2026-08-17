# Contract: `@chatter/core` public API (Phase 1)

This is a library, not a network service — the "contract" is the exported TypeScript surface
that application code and adapter authors compile against. Signatures below are illustrative of
required shape and behavior, not final naming approved character-for-character; naming
refinements are allowed during implementation as long as behavior matches.

## `Chatter` (orchestrator)

```ts
class Chatter {
  constructor(config: { accounts: RegisteredAccount[] });

  start(): Promise<void>;   // FR-003 — idempotent, see data-model.md state transitions
  stop(): Promise<void>;    // FR-003 — idempotent

  on(
    event: "message.created",
    handler: (event: MessageCreatedEvent) => void | Promise<void>
  ): void;
  off(event: "message.created", handler: (...) => void): void;

  send(input: SendInput): Promise<DeliveryResult>; // FR-005, FR-006
  getCapabilities(accountName: string): ReadonlySet<Capability>; // FR-007
}
```

- `constructor` MUST throw `ChatterConfigurationError` synchronously if two entries in
  `accounts` share an `accountName` (FR-002) — fails fast at construction, not at `start()`.
- `send()` MUST reject with `ChatterConfigurationError` if called before `start()` or after
  `stop()` (Story 1, Acceptance Scenario 3).
- A handler registered via `on()` that throws or rejects MUST NOT prevent delivery of
  subsequent events to other handlers or on other accounts (Edge Cases).

## Adapter contract (`@chatter/core`, implemented by every account — fake this phase)

```ts
interface AccountAdapter {
  readonly provider: string;
  getCapabilities(): ReadonlySet<Capability>;
  start(dispatch: (event: MessageCreatedEvent) => void): Promise<void>;
  stop(): Promise<void>;
  send(input: SendInput): Promise<DeliveryResult>;
}
```

- `send()` MUST reject with `ChatterInvalidTargetError` if the target conversation/message
  reference is unrecognized (Story 3, Acceptance Scenario 3).
- `send()` MUST reject with `ChatterUnsupportedCapabilityError` if the request requires a
  capability (e.g. `"thread"`) the adapter's `getCapabilities()` does not include (Story 3,
  Acceptance Scenario 2).
- `send()` MAY reject with `ChatterRateLimitError` (fake account: only when explicitly
  configured to simulate this, per Story 3 Acceptance Scenario 1).

## `@chatter/testing` conformance suite

```ts
function runAccountConformanceSuite(
  createAdapter: () => AccountAdapter
): void; // registers Vitest `describe`/`it` blocks when called inside a test file
```

- MUST exercise: capability query (FR-007), send + delivery result shape (FR-006), invalid
  target rejection, unsupported-capability rejection, start/stop idempotency.
- MUST be importable and callable from a package other than `@chatter/testing` itself with no
  modification (Story 4) — verified in this phase by `@chatter/testing`'s own test file calling
  it against the fake adapter, as a stand-in proof for the real-adapter case that comes later.

## `@chatter/testing` fake adapter

```ts
class FakeAccountAdapter implements AccountAdapter {
  constructor(config?: { capabilities?: Capability[] });
  emitInbound(message: Omit<Message, "account">): void; // test helper, not part of AccountAdapter
  readonly sentMessages: DeliveryResult[]; // test helper — inspect what was "sent"
  simulateRateLimit(retryAfterMs?: number): void; // test helper — next send() rejects with ChatterRateLimitError
}
```

`emitInbound`, `sentMessages`, and `simulateRateLimit` are fake-adapter-only test ergonomics —
not part of the `AccountAdapter` contract itself, so they must not leak into
`runAccountConformanceSuite`'s assumptions about what any adapter must provide.
