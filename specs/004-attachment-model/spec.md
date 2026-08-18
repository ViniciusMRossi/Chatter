# Feature Specification: Attachment Model in Core

**Feature Branch**: `004-attachment-model`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Add an attachment model to @chatter/core — the first ticket in a new phase completing Telegram's feature surface before starting another provider, and a prerequisite for a Slack-inspired desktop test client that needs to send/receive images, videos, and files, not just text. Purely a core/contract ticket — no provider adapter implements it yet."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A received message can carry an attachment (Priority: P1)

A developer building on Chatter wants to receive a message that includes an image, a video, or
an arbitrary file — with or without accompanying text — and have it show up as a normal,
type-safe part of the same message object they already handle for text, rather than as a
separate, bolted-on concept they have to special-case.

**Why this priority**: Nothing else in this ticket matters until the normalized model can even
represent an attachment. This is the foundational change everything else builds on.

**Independent Test**: Construct a message with an attachment (and, separately, one with an
attachment and no text, and one with text and no attachment) and confirm each is a valid,
representable instance of the normalized model — no adapter or network involved.

**Acceptance Scenarios**:

1. **Given** a message that includes both text and an attachment, **When** it's represented in
   the normalized model, **Then** both the text and the attachment (its kind, and whichever of
   filename/MIME type/size are available) are present and accessible.
2. **Given** a message that includes an attachment but no text, **When** it's represented in the
   normalized model, **Then** it's valid with no text present — an attachment does not require a
   caption.
3. **Given** an attachment Chatter received from a provider, **When** the application inspects
   it, **Then** it has a ready-to-use download reference — the application is not handed any
   provider-specific identifier it would need special knowledge to resolve.

---

### User Story 2 - Sending a message with an attachment succeeds when the account supports it (Priority: P1)

A developer wants to send a message with a single attached image, video, or file, through the
exact same send operation they already use for text — supplying either a link to existing
remote content or the raw content itself when it only exists locally — and get back the same
kind of confirmation they already get for a text-only send.

**Why this priority**: This is the other half of the foundational round trip (Story 1 covers
receiving; this covers sending) — together they're the MVP of "attachments work," which is why
both are P1.

**Independent Test**: Using an account configured to support attachments, send a message with an
attachment referencing existing remote content, and separately one with locally-supplied
content; confirm both succeed and return a delivery confirmation, the same shape already
returned for text-only sends.

**Acceptance Scenarios**:

1. **Given** an account that supports attachments, **When** a message is sent with an attachment
   referencing existing remote content (no bytes supplied directly), **Then** the send succeeds
   and a delivery confirmation is returned.
2. **Given** an account that supports attachments, **When** a message is sent with an attachment
   whose content is supplied directly (not a remote reference), **Then** the send succeeds and a
   delivery confirmation is returned.
3. **Given** a send request, **When** it includes more than one attachment, **Then** this is not
   a supported shape — a single send operation carries at most one attachment (see Assumptions).

---

### User Story 3 - An account that doesn't support attachments says so clearly (Priority: P2)

A developer whose application is configured against an account that can't handle attachments
wants to find out immediately and unambiguously why their send failed, rather than have it
silently succeed as a text-only message (losing the attachment) or fail with an unhelpful,
generic error.

**Why this priority**: This is what makes the capability declaration from Story 2 trustworthy —
without it, "the account doesn't support this" is just documentation nobody can rely on
programmatically. Ordered after Stories 1-2 since it's a guardrail on the happy path, not the
path itself.

**Independent Test**: Attempt an attachment-carrying send against an account explicitly
configured without attachment support, and confirm it fails with a specific, identifiable
reason — distinct from every other failure category already in use.

**Acceptance Scenarios**:

1. **Given** an account that does not declare attachment support, **When** a send is attempted
   with an attachment, **Then** it fails with a reason specifically identifiable as "this
   capability isn't supported here" — not a generic failure, and not silently sent as text-only.
2. **Given** the same account, **When** the application checks in advance what it supports,
   **Then** it can determine attachment support is absent without attempting a send first.

---

### User Story 4 - An attachment too large to handle is rejected before anything is sent (Priority: P2)

A developer whose application tries to send an attachment beyond what the account can support
wants to find out immediately, without waiting on a network round trip, so their application can
give fast, clear feedback.

**Why this priority**: A straightforward correctness/UX guardrail, ordered alongside Story 3 as
a P2 — both are about failing clearly rather than about the core happy path itself.

**Independent Test**: Attempt to send a locally-supplied attachment larger than the account's
configured limit and confirm it's rejected immediately, with nothing resembling a transmission
attempt having occurred.

**Acceptance Scenarios**:

1. **Given** an account with a known size limit, **When** a send is attempted with a
   directly-supplied attachment larger than that limit, **Then** it's rejected immediately with a
   reason identifiable as "the request itself was invalid," and no transmission is attempted.
2. **Given** the same account, **When** a send is attempted with an attachment within the limit,
   **Then** the size check does not interfere with an otherwise-valid send.

---

### User Story 5 - The shared contract-conformance check actually proves this, for any future account (Priority: P3)

A developer building the next account implementation (starting with Telegram, right after this
ticket) wants a ready-made, provider-agnostic way to verify their implementation honors the
attachment contract correctly, without having to invent their own checks for it.

**Why this priority**: This doesn't change any behavior by itself — it's proof that everything
above is actually enforced, reusable by every future implementation, not just this ticket's own
tests. Ordered last since it depends on Stories 1-4 existing to have something to check.

**Independent Test**: Run the existing shared conformance check suite against an account
implementation configured both with and without attachment support, and confirm it correctly
validates both configurations without any implementation-specific exceptions.

**Acceptance Scenarios**:

1. **Given** an account implementation that declares attachment support, **When** the shared
   conformance checks run against it, **Then** the attachment-related checks pass.
2. **Given** an account implementation that does not declare attachment support, **When** the
   same shared conformance checks run against it, **Then** they correctly confirm it rejects an
   attachment-carrying send, rather than skipping the check or reporting a false pass.

---

### Edge Cases

- What happens if an attachment's filename, MIME type, and size are all unavailable from the
  provider? (Must still be representable — none of these fields are required, only the kind and
  a way to reference the content are.)
- What happens if a locally-supplied attachment is compared against a size limit but the account
  doesn't have a known limit at all? (No size check applies in that case — the ticket's size
  rejection behavior is specifically about accounts with a *known* limit; the absence of a stated
  limit is not itself a rejection reason.)
- What happens to an attachment referencing existing remote content whose actual size is only
  discoverable once a provider processes it? (Not covered by the client-side size check in this
  ticket — that check only applies when content is supplied directly and its size is already
  known; a provider's own after-the-fact rejection is a separate concern for whichever ticket
  implements a real account against a real provider.)
- What happens when an existing (pre-attachment) account implementation is exercised by the
  updated shared conformance checks? (Must continue to pass exactly as before — this ticket must
  not break any existing, already-conformant implementation.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The normalized message model MUST be able to represent zero or more attachments
  alongside an optional text field — a message may have text only, an attachment only, or both.
- **FR-002**: Each attachment MUST identify its kind, from a small, closed set (image, video, or
  a general file), and MAY carry a filename, a MIME type, and a size — none of these three are
  required.
- **FR-003**: An attachment received by the application MUST carry a ready-to-use download
  reference — no provider-specific identifier requiring further, provider-aware resolution may
  reach application code.
- **FR-004**: The outbound send operation MUST accept at most one attachment per call, supplied
  either as a reference to existing remote content or as directly-supplied content.
- **FR-005**: A new, distinct capability value MUST exist so an account can declare whether it
  supports attachment-carrying sends, following the same declaration pattern as existing
  capabilities.
- **FR-006**: A send with an attachment MUST fail, with a reason specifically identifiable as an
  unsupported-capability failure, when attempted against an account that does not declare
  attachment support — the attachment MUST NOT be silently dropped, and the message MUST NOT be
  silently sent as text-only.
- **FR-007**: A send with a directly-supplied attachment exceeding an account's known size limit
  MUST fail immediately, before any transmission is attempted, with a reason specifically
  identifiable as an invalid-request failure.
- **FR-008**: The shared fake account implementation and shared conformance-check suite MUST be
  extended to exercise attachment-carrying sends, both for an account configured to support them
  and one configured not to, without weakening or bypassing any existing, pre-attachment check.
- **FR-009**: This ticket MUST NOT require or perform any automatic fetching of attachment
  content by Chatter itself, and MUST NOT interpret, classify, or otherwise process attachment
  content — Chatter remains transport-only for attachments exactly as it already is for text.

### Key Entities

- **Attachment**: A normalized description of a single piece of media accompanying a message —
  its kind (image, video, or file), optional filename/MIME type/size, and a reference to the
  actual content (a ready-to-use download reference when received; a remote-content reference or
  directly-supplied content when being sent).
- **Message** *(extended)*: Now carries zero or more attachments in addition to its existing
  optional text.
- **Capability** *(extended)*: Gains one new, closed-set value representing attachment support.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A message can be constructed and validated with any combination of text and
  attachment presence (both, attachment-only, text-only) with zero errors, in automated tests
  requiring no real provider.
- **SC-002**: 100% of attachment-carrying sends against a capability-declaring account succeed
  and return a delivery confirmation, for both a remote-reference attachment and a
  directly-supplied one.
- **SC-003**: 100% of attachment-carrying sends against a non-declaring account are rejected with
  the correct, specific failure reason — never a silent text-only fallback, never a generic
  failure.
- **SC-004**: 100% of oversized directly-supplied attachments are rejected before any
  transmission attempt, verified by confirming zero transmission-equivalent calls occurred.
- **SC-005**: The full existing automated suite, including the shared conformance checks now
  extended for attachments, continues to pass unmodified for behavior that predates this ticket —
  zero regressions.
- **SC-006**: The shared conformance checks, run against the one account implementation that
  exists today, validate both the supported and unsupported attachment paths correctly — proven
  reusable, not hardcoded to a single scenario.

## Assumptions

- "One attachment per send" is a deliberate simplification for this ticket, not a permanent
  ceiling — multiple attachments per logical message is out of scope here and can be revisited
  later if a real need appears.
- The three-way attachment kind (image / video / file) is a deliberately small, closed set
  matching how `Capability` itself is already modeled — it is not an open-ended MIME-type
  taxonomy, and finer-grained kinds are not needed for this ticket's scope.
- No provider adapter implements this contract as part of this ticket — the very next ticket
  (Telegram) is where a real implementation and its own size limits, capability declaration, and
  attachment mapping land. This ticket only proves the contract is sound and enforceable using
  the existing fake account.
- "Known size limit" varies per account implementation and isn't itself specified by this
  ticket — this ticket only requires that *when* an account has one, it's enforced client-side
  before transmission; the actual limit value is an implementation detail of whichever account
  declares it (starting with the fake account, for this ticket's own tests).
- Chatter does not persist attachment content by default, matching its existing stance for
  message text — nothing in this ticket introduces any storage of attachment bytes.
