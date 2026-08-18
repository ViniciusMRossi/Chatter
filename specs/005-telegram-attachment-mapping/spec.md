# Feature Specification: Telegram Attachment Mapping

**Feature Branch**: `005-telegram-attachment-mapping`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Add attachment support to @chatter/telegram — the second ticket in the 'complete Telegram's feature surface before moving to another provider' phase, implementing the provider side of the attachment contract that specs/004-attachment-model added to @chatter/core. A host application using @chatter/telegram can receive a Telegram photo, video, or document as a normalized Attachment on an inbound Message, and can send a message with a single attachment — either referencing existing remote content or supplying local bytes directly — through the same chatter.send() call already used for text. The adapter declares the 'attachments' capability honestly, and Telegram's own real constraints (size limits, and the fact that Telegram identifies uploaded files by reference rather than a directly downloadable URL) are surfaced as clear, typed failures rather than silent truncation, silent drops, or generic errors."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A developer receives Telegram media as a normalized attachment (Priority: P1)

A developer building on Chatter, using the Telegram provider, wants an incoming photo, video, or
document to arrive as a normal, type-safe attachment on the message they already handle — with
or without an accompanying caption — rather than being silently dropped as it is today.

**Why this priority**: Nothing else in this ticket matters until inbound media actually reaches
the application. This is the foundational half of the round trip.

**Independent Test**: Deliver a synthetic webhook update carrying a photo, a video, and a
document (each once with a caption, once without) and confirm each results in a dispatched
message whose attachment is present with the correct kind and a usable download reference — no
real Telegram credentials involved.

**Acceptance Scenarios**:

1. **Given** an incoming photo with a caption, **When** it's delivered, **Then** the dispatched
   message has an image attachment and the caption as its text.
2. **Given** an incoming photo with no caption, **When** it's delivered, **Then** the dispatched
   message has an image attachment and no text.
3. **Given** an incoming video or document, **When** it's delivered, **Then** the dispatched
   message has an attachment of the matching kind (video or file respectively).
4. **Given** any incoming media, **When** the application inspects the resulting attachment,
   **Then** it has a directly usable download reference — never a Telegram-specific identifier
   requiring further, provider-aware resolution.
5. **Given** an incoming photo, which Telegram always delivers at several resolutions, **When**
   it's mapped to an attachment, **Then** the highest-resolution version is the one referenced.

---

### User Story 2 - A developer sends a message with an attachment via Telegram (Priority: P1)

A developer wants to send a photo, video, or document through the same send operation already
used for text — supplying either a reference to content that already exists remotely, or the raw
bytes of a file that only exists locally — with or without an accompanying caption.

**Why this priority**: The other half of the foundational round trip; together with Story 1 this
is the MVP of "Telegram attachments work."

**Independent Test**: Send a message with a remote-content-referencing attachment, and separately
one with directly-supplied bytes, each with and without a caption, and confirm each succeeds and
results in the correct kind of outbound call.

**Acceptance Scenarios**:

1. **Given** an attachment referencing content that already exists remotely, **When** it's sent
   (with or without a caption), **Then** the send succeeds without any bytes of that content
   passing through the adapter itself.
2. **Given** an attachment whose content is supplied directly, **When** it's sent (with or
   without a caption), **Then** the send succeeds and the content is genuinely transmitted.
3. **Given** an attachment of a given kind (image, video, or file), **When** it's sent, **Then**
   the outbound call Telegram receives is the one appropriate to that kind.
4. **Given** the account's declared capabilities, **When** an application checks them in
   advance, **Then** attachment support is now included — matching what Stories 1-2 actually
   deliver.

---

### User Story 3 - An attachment too large for Telegram to accept is rejected immediately (Priority: P2)

A developer whose application tries to send a locally-supplied attachment larger than what
Telegram actually accepts for that kind of media wants to find out immediately, without waiting
on a network round trip.

**Why this priority**: A correctness/UX guardrail on the send path from Story 2 — ordered after
the two P1 stories since it protects the happy path rather than being the path itself.

**Independent Test**: Attempt to send directly-supplied content exceeding Telegram's real limit
for its kind and confirm it's rejected immediately, with no outbound call attempted.

**Acceptance Scenarios**:

1. **Given** directly-supplied content exceeding Telegram's real size limit for its kind,
   **When** a send is attempted, **Then** it's rejected immediately as an invalid request, and no
   outbound call occurs.
2. **Given** directly-supplied content within Telegram's real size limit for its kind, **When** a
   send is attempted, **Then** the size check does not interfere with an otherwise-valid send.
3. **Given** an attachment referencing existing remote content (no bytes supplied directly),
   **When** a send is attempted, **Then** no client-side size rejection occurs, regardless of
   size — that content's size isn't known until Telegram itself processes it.

---

### User Story 4 - Telegram's real constraints are documented, not discovered by surprise (Priority: P2)

A developer integrating against this adapter wants to know, up front, about the real limits and
behaviors of Telegram's media handling — how large a file can be sent, how large a received file
can actually be downloaded again, and that a download reference doesn't stay valid forever —
rather than discovering them through a confusing failure in production.

**Why this priority**: Directly supports Stories 1-3 being usable in practice; ordered as a P2
alongside Story 3 since both are about making the real constraints legible rather than being the
core capability itself.

**Independent Test**: A developer reads the adapter's documentation and can correctly predict,
without experimentation, whether a given send will be accepted and whether a given received
attachment will still be downloadable a few minutes vs. a few hours later.

**Acceptance Scenarios**:

1. **Given** the adapter's documentation, **When** a developer looks up the size limit for
   sending a given kind of media, **Then** the documented limit matches what Story 3 actually
   enforces.
2. **Given** the adapter's documentation, **When** a developer looks up whether a received
   attachment's download reference is permanent, **Then** the documentation correctly states it
   is temporary and describes the practical implication (a large file accepted on the way in may
   not be re-downloadable through this reference at all, and any reference expires well before
   most applications would expect).

---

### User Story 5 - The shared conformance suite proves the full attachment contract for this adapter (Priority: P3)

A developer maintaining Chatter wants confidence that this adapter genuinely honors the
attachment contract every adapter is expected to honor — not just that its own hand-written
tests pass, but that the same reusable checks used to validate every adapter validate this one
too, on both the "supported" and "unsupported" sides of that contract.

**Why this priority**: Proof, not new behavior — depends on Stories 1-2 existing to have
something to validate. Ordered last, as in every prior ticket that added this kind of check.

**Independent Test**: Run the existing shared conformance suite against this adapter and confirm
its attachment-related checks now exercise real (non-placeholder) send behavior, not a
capability-declaration mismatch.

**Acceptance Scenarios**:

1. **Given** this adapter now declares attachment support, **When** the shared conformance
   suite's attachment checks run against it, **Then** the previously-inapplicable "supported"
   check now genuinely exercises this adapter's send behavior and passes.
2. **Given** the same adapter, **When** the full existing conformance and adapter-specific test
   suites run, **Then** every pre-existing check (text, reply, dedup, migration handling, error
   mapping) continues to pass unmodified.

---

### User Story 6 - Confidence the adapter works against real Telegram servers (Priority: P3)

A developer wants a documented way to verify, against a real Telegram bot, that sending and
receiving an actual image genuinely works — not just that the stubbed test suite says so.

**Why this priority**: Mirrors the precedent already established for this adapter's other
features — a real-world check that can't be performed by an automated agent without live
credentials, so it's documented for a human to run.

**Independent Test**: A human follows the documented steps against a real bot and either
confirms success or gets an actionable failure.

**Acceptance Scenarios**:

1. **Given** a real Telegram bot and the documented checklist, **When** a human sends and
   receives an image through it, **Then** the checklist either confirms the round trip worked or
   surfaces a specific, actionable problem.

---

### Edge Cases

- What happens when a received photo has no caption at all? (Covered by Story 1 Scenario 2 — the
  resulting message has an attachment and no text, which core already supports.)
- What happens when an attachment references remote content whose actual size turns out to
  exceed what Telegram will accept? (Not covered by this ticket's client-side size check —
  that check only applies to directly-supplied content whose size is already known; a
  remote-reference attachment's eventual rejection by Telegram itself surfaces through the
  adapter's existing general-purpose failure handling, not a new check.)
- What happens to a previously-received attachment's download reference after enough time has
  passed? (Out of scope to keep valid — the adapter hands back what was true at the moment of
  receipt; an application needing the content later is expected to have already fetched it, or
  to accept that re-fetching may fail.)
- What happens when a single update carries both a caption-less document and no other content?
  (Same as any other caption-less media — a valid attachment-only message, no different handling
  needed.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The adapter MUST dispatch an incoming update carrying a photo, video, or document,
  not only one carrying plain text.
- **FR-002**: Each dispatched attachment MUST identify its kind correctly (image for photo,
  video for video, file for document), and MUST carry a directly usable download reference —
  never a Telegram-specific identifier that itself requires further, provider-aware resolution.
- **FR-003**: When an incoming photo is delivered at multiple resolutions (as Telegram always
  does), the attachment MUST reference the highest-resolution version available.
- **FR-004**: An incoming media update's caption, when present, MUST become the dispatched
  message's text; when absent, the dispatched message's text MUST be absent — an attachment does
  not require a caption.
- **FR-005**: The adapter's send operation MUST accept a single attachment per call, supplied
  either as a reference to existing remote content or as directly-supplied content, and MUST
  choose the outbound mechanism appropriate to the attachment's kind.
- **FR-006**: A send with a reference to existing remote content MUST NOT require the content's
  bytes to pass through the adapter.
- **FR-007**: A send with directly-supplied content whose size exceeds the real limit for its
  kind MUST be rejected immediately, before any outbound call, as an invalid-request failure — no
  such client-side check applies to a remote-content reference, whose size isn't known in
  advance.
- **FR-008**: The account's declared capabilities MUST include attachment support once this
  ticket lands, replacing the current declaration that omits it.
- **FR-009**: The adapter's documentation MUST state the real size limits enforced by FR-007 for
  each kind of media, and MUST state that a received attachment's download reference is
  temporary and not guaranteed to remain valid indefinitely — including the specific case where
  a large received file may not be re-downloadable through this adapter at all, regardless of
  how it was originally sent.
- **FR-010**: The shared, adapter-agnostic conformance suite MUST be exercised against this
  adapter with attachment support enabled, so its attachment-related checks validate genuine
  send behavior rather than being inapplicable to this adapter, without weakening or bypassing
  any check that predates this ticket.
- **FR-011**: A documented, human-run checklist MUST exist for verifying an actual image
  round-trips (send and receive) against a real Telegram bot, following the same pattern as this
  adapter's existing verification checklist for text.

### Key Entities

- **Attachment** *(as defined in specs/004-attachment-model, not redefined here)*: What this
  ticket populates with real values derived from Telegram's own media updates and consumes when
  constructing real outbound calls.
- **Telegram media update**: An inbound update carrying a photo, video, or document, plus an
  optional caption — the source this ticket maps from.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of synthetic inbound updates carrying a photo, video, or document (with and
  without a caption) result in a dispatched message with the correct attachment kind and a usable
  download reference, verified in automated tests requiring no real Telegram credentials.
- **SC-002**: 100% of sends carrying an attachment — for both a remote-content reference and
  directly-supplied content, each with and without a caption — succeed and produce the correct
  kind of outbound call, verified against the existing stubbed transport, requiring no real
  Telegram credentials.
- **SC-003**: 100% of directly-supplied attachments exceeding the real limit for their kind are
  rejected before any outbound call occurs, verified by confirming zero such calls were made.
- **SC-004**: The account's declared capabilities include attachment support, verified by an
  automated check.
- **SC-005**: The full existing automated suite for this adapter, including the now-fully-
  exercised shared conformance suite, continues to pass unmodified for every behavior that
  predates this ticket — zero regressions.
- **SC-006**: A human completes the new manual-verification section (sending and receiving a
  real image against a real bot) and records a pass, or a specific, actionable failure.

## Assumptions

- This ticket implements exactly the contract specs/004-attachment-model already defined in
  `@chatter/core` — it does not modify that contract (e.g., still one attachment per send, still
  the same three-kind closed set).
- Telegram's real numeric limits (size caps for sending each kind of media, and the separate,
  smaller cap on re-downloading a previously-received file) are treated as current, real
  platform behavior to document and enforce, not values this ticket invents — if Telegram's
  actual published limits differ from what's assumed during planning, the enforced/documented
  values are corrected to match Telegram's real behavior, not the other way around.
- A received attachment's download reference is treated as valid only for a limited window,
  consistent with how Telegram actually issues these references — this ticket does not attempt
  to make them longer-lived or to proactively refresh them.
- Multiple attachments per message, thumbnailing/transcoding, and any UI or example-app work
  remain out of scope, unchanged from prior tickets' scoping.
