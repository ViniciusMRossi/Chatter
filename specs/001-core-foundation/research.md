# Phase 0 Research: Core Package Foundation

All Technical Context items were resolvable from ratified project decisions
(`Docs/Tech-Stack-Constitution.md`, the project constitution, and the user's Phase 0 answers) —
no open unknowns remain. This document records the reasoning for the design-relevant choices so
future tickets don't re-litigate them.

## Decision: Inbound event delivery via `node:events` `EventEmitter`

**Decision**: The orchestrator exposes inbound events (`message.created` in this phase) through
a standard Node `EventEmitter`-style `on()`/`off()` API.

**Rationale**: The roadmap's Open Decision #2 ("callbacks, EventEmitter, AsyncIterable, or a
combination") is explicitly deferred past this phase in the spec's Assumptions. `EventEmitter` is
a Node builtin (no new dependency), matches the illustrative public API already shown in the
product requirements doc (`chatter.on("message.created", ...)`), and is sufficient to satisfy
FR-004. It does not preclude adding an `AsyncIterable` consumption mode later — that would be an
additive API surface, not a breaking change to this phase's contract.

**Alternatives considered**:
- *Plain callback registered at construction time*: simpler, but doesn't allow multiple
  independent listeners (e.g. logging middleware alongside the app's own handler), which
  FR-015-adjacent middleware hooks will need later. Rejected as premature to lock in.
- *AsyncIterable-only*: better for backpressure (NFR-007) but is a bigger design commitment and
  a less familiar API for a v0 library; the spec's Edge Cases around slow/throwing handlers are
  satisfiable with `EventEmitter` plus documented handler-isolation behavior (see data-model.md /
  orchestrator behavior notes). Deferred, not rejected — tracked as a roadmap Open Decision, not
  reopened here.

## Decision: Typed errors as an `Error` subclass hierarchy, not an error-code union

**Decision**: `ChatterError` is the abstract base (extends `Error`), with one concrete subclass
per FR-008 category (`ChatterConfigurationError`, `ChatterAuthenticationError`,
`ChatterAuthorizationError`, `ChatterRateLimitError`, `ChatterInvalidTargetError`,
`ChatterUnsupportedCapabilityError`, `ChatterProviderUnavailableError`,
`ChatterUnknownError`). `ChatterRateLimitError` and `ChatterProviderUnavailableError` carry a
`retryable: boolean` and optional `retryAfterMs?: number` per FR-009.

**Rationale**: Subclassing gives consumers `instanceof` narrowing (idiomatic in TypeScript,
works with `catch` blocks and exhaustiveness checks) and preserves native stack traces. A
code/union-only approach (`{ code: "RATE_LIMIT", ... }`) would also work but loses
`instanceof` ergonomics and native error semantics (e.g. `Error.cause` chaining to a raw
provider error, useful later when real adapters wrap provider SDK errors) for no compensating
benefit at this scale.

**Alternatives considered**: discriminated-union error objects (rejected — worse ergonomics,
no upside); a single generic `ChatterError` with a `category` string field only (rejected — loses
compile-time exhaustiveness when application code switches on error type).

## Decision: Conformance suite as parameterized test factories, not a fixed test file

**Decision**: `@chatter/testing`'s conformance suite is exported as one or more functions (e.g.
`runAccountConformanceSuite(createAccount: () => Account)`) that a package's own Vitest file
calls, rather than a self-running test file baked into `@chatter/testing`.

**Rationale**: FR-012 requires the suite to be runnable against any account implementation,
starting with the fake one and, in a later ticket, Telegram. A parameterized factory is the only
shape that lets a future `@chatter/telegram` package import the same suite and point it at a
real (or sandboxed) Telegram account with zero changes to the suite itself — matching Story 4's
acceptance criteria directly.

**Alternatives considered**: copy-pasting the fake account's test file as a starting template for
each new adapter (rejected — this is exactly the "invented their own test suite" failure mode
Story 4 exists to prevent, and it silently drifts out of sync across adapters over time).

## Decision: pnpm workspace layout — `packages/<name>` with `@chatter/<name>` as the `package.json` name

**Decision**: Directories are `packages/core`, `packages/testing` (not `packages/@chatter/core`);
the `@chatter` npm scope is applied only inside each `package.json`'s `"name"` field.

**Rationale**: Matches common pnpm-workspace convention; keeps directory names free of the `@`
character (avoids shell-quoting friction in scripts/CI) while still publishing under the
intended scope. The final npm scope/ownership is still an open decision per the roadmap — this
only affects the `package.json` `name` field, which is a one-line change if the scope changes
later, not a directory restructuring.

**Alternatives considered**: `packages/@chatter/core` directory nesting (rejected — no
practical benefit, adds path-quoting friction); npm workspaces or Turborepo (rejected in the
earlier Phase 0 stack decision — see `Docs/Tech-Stack-Constitution.md`).
