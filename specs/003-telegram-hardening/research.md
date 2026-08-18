# Phase 0 Research: Telegram Adapter Hardening

## Decision: Dedup window is a bounded `Map`-based FIFO set, capacity 1000

**Decision**: `UpdateDedupWindow` wraps a `Map<number, true>` (JS `Map`s preserve insertion
order). `has(updateId)` checks membership; `record(updateId)` inserts and, if size exceeds a
fixed capacity of 1000, deletes the oldest entry (`map.keys().next().value`) before inserting the
new one.

**Rationale**: No new dependency needed — insertion-order `Map` iteration gives FIFO eviction for
free. 1000 entries comfortably covers Telegram's realistic redelivery window (redeliveries happen
within seconds to low minutes of the original, not after thousands of intervening updates) while
keeping memory bounded and trivially predictable, satisfying FR-002 and constitution Principle
VI. This mirrors ticket #1's own precedent (`FR-013`: Chatter *may* suppress duplicates within an
adapter instance's lifetime; no durability guarantee implied or needed).

**Alternatives considered**: A time-based TTL cache (rejected — adds complexity and a timer/clock
dependency for marginal benefit over a fixed-capacity FIFO, given Telegram redelivers quickly
after the original, not after an arbitrary delay); an LRU (rejected — FIFO is simpler to reason
about and sufficient, since "seen recently" for redelivery purposes tracks arrival order, not
access recency — nothing ever re-reads an old entry to bump it).

## Decision: `migrate_to_chat_id` surfaces via the existing `ChatterInvalidTargetError` message

**Decision**: In `mapTelegramError`, when a `GrammyError`'s `parameters.migrate_to_chat_id` is
present, the resulting `ChatterInvalidTargetError`'s message includes the new chat ID in a
grep-able form, e.g. `` `Telegram target invalid: chat migrated to supergroup, new chat ID: ${id}` ``.

**Rationale**: FR-007 (and the spec's own Assumptions) rule out introducing a new `ChatterError`
subclass or a structured field on the existing one for this ticket's scope — that's a core-level
API decision bigger than a hardening ticket. Message-text is the only channel available without
touching `@chatter/core`, and it's sufficient to satisfy the spec's literal requirement
("discoverable from it") — an application that cares can parse or regex the message, and a
follow-up ticket can promote this to a structured field on `ChatterInvalidTargetError` in core if
that need materializes.

**Alternatives considered**: A new `ChatterChatMigratedError` subclass (rejected — explicitly
out of scope per the spec's Non-Goals; would require a `@chatter/core` change and constitution
Principle II sign-off this ticket doesn't have); a structured `cause` object carrying the new ID
(rejected for now — `cause` is documented elsewhere in this codebase as attaching the *original*
provider error for debugging, not as a typed API surface applications are meant to programmatically
depend on; overloading it here would blur that convention).

## Decision: Message-length pre-validation uses `ChatterConfigurationError`

**Decision**: `TelegramAccountAdapter.send()` checks `input.text.length > 4096` (Telegram's
documented limit) before any network call, throwing `ChatterConfigurationError` if exceeded.

**Rationale**: None of the eight existing error categories is "the request itself is malformed,"
but `ChatterConfigurationError` already carries that meaning elsewhere in this codebase —
`Chatter.send()` in core throws it for calling `send()` before `start()` or for an unknown
account name, i.e. "the caller's own call was invalid," not a provider-side failure. A too-long
message is the same shape of problem (caller error, not Telegram's fault), so reusing this
category is the closest fit without inventing a new one, consistent with FR-007.

**Alternatives considered**: `ChatterUnknownError` (rejected — reserves that category, correctly,
for genuinely unanticipated failures; a documented 4096-char limit checked proactively is the
opposite of "unknown"); waiting for Telegram's own 400 rejection and mapping that instead
(rejected — defeats Story 3's explicit "fails immediately... no request is made to Telegram at
all" acceptance criterion).

## Decision: Shutdown cleanup failure surfaces via an optional, additive callback

**Decision**: `TelegramAccountAdapterOptions` gains one new optional field:
`onNonFatalError?: (message: string) => void`, defaulting to `console.error` when not supplied.
`stop()` still never throws; on a `deleteWebhook` failure, it maps the error through the existing
`mapTelegramError` sanitization and calls `onNonFatalError(mapped.message)` — a plain string, not
the raw error object, so the redaction guarantee holds regardless of what a caller's callback
does with it.

**Rationale**: FR-007 prohibits changing the *existing* public contract (nothing about ticket
#2's `AccountAdapter` shape, webhook handler, capabilities, or errors changes) but doesn't
prohibit an additive, optional, backward-compatible constructor option — every existing call
site from ticket #2 keeps working unchanged. This is more testable than hardcoding `console.error`
(a test can inject a spy) while still logging out of the box for anyone who doesn't care to
customize it, matching NFR-008's "without requiring a specific logging vendor."

**Alternatives considered**: Hardcoding `console.error` only (rejected — untestable without
mocking global console, and NFR-008 explicitly wants vendor-neutral observability hooks);
throwing from `stop()` (rejected — explicitly ruled out by spec Story 4 Acceptance Scenario 1,
"does not block the host application's shutdown sequence").
