# Feature Specification: Telegram Adapter Hardening

**Feature Branch**: `003-telegram-hardening`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Harden the Telegram provider adapter — a follow-up to ticket #2 (merged) addressing real operational gaps found in a readiness assessment before running against production Telegram traffic: duplicate webhook deliveries, group-to-supergroup migration, oversized messages, and silent cleanup failures. No change to the existing public contract (adapter shape, webhook handler signature, capability set, error hierarchy). Automatic retry and outbound throttling are explicitly excluded — they're already deliberate application-layer concerns in this project's design, not gaps."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A redelivered webhook update isn't processed twice (Priority: P1)

A developer running the Telegram adapter in production knows Telegram will occasionally
redeliver the same update (for example, if their server's response was slow or timed out on the
first delivery) — and doesn't want their message-handling logic to run twice for what is, from
the user's perspective, a single message.

**Why this priority**: Of everything found in the readiness assessment, this is the one most
likely to cause a visibly wrong outcome in production (a duplicated reply, a double-counted
action) rather than just an unhandled edge case, and Telegram redelivery is a normal, expected
occurrence, not a rare failure.

**Independent Test**: Deliver the same synthetic webhook update (identical `update_id`) to the
webhook handler twice in a row and confirm the application's handler is invoked exactly once.

**Acceptance Scenarios**:

1. **Given** the adapter has already processed an update with a given `update_id`, **When** a
   webhook request carrying that same `update_id` arrives again, **Then** the request is
   acknowledged successfully but no second `message.created` event is delivered to the
   application.
2. **Given** the adapter has been running long enough that its bounded duplicate-tracking
   history could reasonably have discarded very old entries, **When** a genuinely new update
   with an unseen `update_id` arrives, **Then** it is still processed normally — the
   deduplication mechanism does not degrade into rejecting legitimate new updates.

---

### User Story 2 - A message send failure reveals a chat's new ID after group migration (Priority: P2)

A developer whose bot is used in Telegram groups knows that a group can be upgraded to a
"supergroup" at any time by its owner, which silently changes the chat's ID — a message sent to
the old ID fails. The developer wants to be able to discover the new ID from the failure itself
so their application can react (e.g., update stored state and retry) instead of being stuck with
an opaque "invalid target" failure and no path forward.

**Why this priority**: This is a real, recurring Telegram platform event bots must contend with,
but it's ordered below duplicate-delivery handling because it's narrower in scope (only affects
bots active in groups that later upgrade) and doesn't corrupt behavior the way double-processing
does — it just leaves useful information on the table today.

**Independent Test**: Simulate a send failure whose response indicates the chat has migrated to
a new ID, and confirm that new ID is discoverable from the resulting failure.

**Acceptance Scenarios**:

1. **Given** a send is attempted against a group chat that has migrated to a supergroup,
   **When** Telegram's response indicates the new chat ID, **Then** the resulting failure is
   still identifiable as an invalid-target problem, and the new chat ID is discoverable from it.
2. **Given** a send fails for a reason unrelated to migration, **When** the failure is produced,
   **Then** nothing about migration is fabricated or implied — this behavior only activates when
   Telegram actually signals a migration.

---

### User Story 3 - An oversized outbound message fails immediately, not after a round trip (Priority: P2)

A developer whose application accidentally (or intentionally, e.g. from user-generated content)
tries to send a message longer than Telegram allows wants to find out immediately, with a clear
reason, rather than waiting on a network round trip only to receive a generic failure.

**Why this priority**: This is a straightforward correctness/UX improvement with no operational
urgency behind it (unlike Stories 1-2, nothing breaks silently in production without it) — it
just makes an existing, already-typed failure path faster and clearer.

**Independent Test**: Attempt to send text exceeding Telegram's documented length limit and
confirm the failure happens without any outbound call being made.

**Acceptance Scenarios**:

1. **Given** outbound text exceeds Telegram's documented character limit, **When** a send is
   attempted, **Then** it fails immediately with a typed error, and no request is made to
   Telegram at all.
2. **Given** outbound text is within the limit, **When** a send is attempted, **Then** behavior
   is unchanged from before this hardening work.

---

### User Story 4 - A failed shutdown cleanup step is no longer invisible (Priority: P3)

A developer investigating unexpected behavior after their application restarted (for example, a
stale webhook registration Telegram is still delivering to) wants some way to discover that the
adapter's shutdown cleanup didn't actually succeed, instead of the failure vanishing with no
trace.

**Why this priority**: This is an operability/debuggability improvement, not something that
changes correct-path behavior — it only matters when something has already gone wrong during
shutdown, which is expected to be rare.

**Independent Test**: Force the adapter's shutdown cleanup step to fail and confirm the failure
is discoverable somehow, while shutdown itself still completes without throwing.

**Acceptance Scenarios**:

1. **Given** the adapter's shutdown cleanup step fails, **When** `stop()` is called, **Then**
   `stop()` still completes successfully (does not throw, does not block the host application's
   shutdown sequence), and the failure is discoverable rather than silently discarded.
2. **Given** the bot token or webhook secret exist in the adapter's configuration, **When** a
   shutdown cleanup failure is surfaced per Scenario 1, **Then** neither secret appears anywhere
   in what's surfaced.

---

### User Story 5 - Confidence that the adapter actually works against real Telegram servers (Priority: P3)

A developer (or reviewer) wants direct evidence that the adapter — which up to this point has
only ever been exercised against a stubbed test transport — actually works against Telegram's
real infrastructure: real webhook registration, real update delivery, real timing.

**Why this priority**: This doesn't add or fix any behavior by itself — it's verification of
everything else, which is why it's ordered last and, unlike the other stories, isn't something
an automated test suite can satisfy on its own.

**Independent Test**: A human follows a documented checklist against a real Telegram bot and
confirms each step works as expected.

**Acceptance Scenarios**:

1. **Given** a documented manual verification checklist, **When** a human follows it against a
   real bot, **Then** every step either passes or produces a clear, actionable failure to
   investigate — the checklist itself is complete enough that no undocumented steps are needed.

---

### Edge Cases

- What happens if the same `update_id` is redelivered after the adapter's bounded duplicate
  history has aged it out? (Acceptable to process it again — this mechanism is a best-effort
  reduction of a known, common redelivery pattern, not a durable guarantee; see ticket #1's
  precedent that durable deduplication is an application concern, not this library's.)
- What happens if outbound text is exactly at the length limit, not over it? (Must be accepted,
  not rejected — the limit is inclusive.)
- What happens if a migration-indicating failure occurs on an account that has no way to
  automatically retarget the send? (No automatic retry occurs — see Non-Goals; the application
  decides what to do with the discovered new chat ID.)
- What happens if `stop()`'s cleanup fails for a reason that itself would risk exposing a secret
  if surfaced naively (e.g. an error object containing a URL)? (The existing secret-redaction
  behavior from ticket #2 still applies to whatever gets surfaced here.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The adapter MUST NOT deliver a second `message.created`-equivalent event for a
  webhook update whose `update_id` it has already processed within a bounded, recent history.
- **FR-002**: The duplicate-tracking history MUST be bounded (fixed maximum size or age) and
  in-memory only — it MUST NOT be presented as a durable or exhaustive deduplication guarantee.
- **FR-003**: When a send fails because Telegram indicates the target chat has migrated to a new
  ID, that new ID MUST be discoverable from the resulting failure.
- **FR-004**: Outbound text exceeding Telegram's documented per-message character limit MUST be
  rejected with a typed failure before any network call is attempted.
- **FR-005**: A failure during the adapter's shutdown cleanup step MUST NOT prevent `stop()`
  from completing successfully, and MUST be discoverable rather than silently discarded.
- **FR-006**: Whatever surfaces a shutdown cleanup failure (per FR-005) MUST NOT include the bot
  token or webhook secret, consistent with the existing secret-redaction behavior from ticket #2.
- **FR-007**: None of the above changes MAY alter the adapter's existing public contract:
  the `AccountAdapter` shape, the webhook handler's request/response signature, the declared
  capability set, or the set of `ChatterError` subclasses in use.
- **FR-008**: A documented, human-followable checklist MUST exist for verifying the adapter
  against a real Telegram bot, covering at minimum: webhook registration, a direct-chat round
  trip, and a group-chat round trip.

### Key Entities

- **Update deduplication window**: The bounded, in-memory record of recently-processed
  `update_id`s an adapter instance keeps to detect redelivery. Exists only for the lifetime of
  the adapter instance; not persisted.
- **Chat migration signal**: Telegram's own indication, attached to certain failed responses,
  that a chat's identifier has changed. Not something Chatter or the adapter causes — only
  detects and surfaces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A redelivered update (identical `update_id`) results in zero additional
  application-visible events, verified across repeated test runs.
- **SC-002**: 100% of simulated migration failures surface the new chat ID; 100% of
  non-migration failures do not fabricate one.
- **SC-003**: An oversized send is rejected with zero outbound calls recorded, in under the same
  time budget as any other synchronous validation in this codebase (no network-round-trip delay).
- **SC-004**: A forced shutdown-cleanup failure is discoverable in 100% of test runs, while
  `stop()` itself still resolves successfully every time.
- **SC-005**: The existing shared conformance suite and full non-live test suite from ticket #2
  continue to pass unmodified, with zero real Telegram credentials, after this work.
- **SC-006**: A human with no prior undocumented knowledge can complete the manual verification
  checklist against a real bot without needing to ask anyone a question not already answered by
  the checklist or the existing adapter documentation.

## Assumptions

- "Bounded" for the deduplication window means a reasonable fixed capacity (e.g. on the order of
  hundreds of recent update IDs) rather than a specific number mandated by this spec — the exact
  figure is a technical decision for the planning phase, not a business requirement.
- Automatic retry logic and proactive outbound rate-limiting/throttling are explicitly excluded
  from this ticket, per the input's stated rationale: they are deliberate existing
  application-layer responsibilities in this project's architecture (the typed rate-limit/
  provider-unavailable errors already expose what an application needs to make that decision
  itself), not overlooked gaps.
- No new `ChatterError` subclass is introduced — the migration ID from FR-003 surfaces through
  the existing `ChatterInvalidTargetError` (message content is an acceptable channel for this;
  a structured field would require a core-level change out of scope here).
- The manual verification checklist (FR-008, Story 5) is a documentation deliverable a human
  executes — it is not satisfied by, and does not need to be satisfied by, the automated test
  suite.
- This hardening applies only to the text-message flow already supported; it does not expand
  adapter scope to any other Telegram update type.
