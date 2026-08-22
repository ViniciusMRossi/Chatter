# Feature Specification: Mentions

**Feature Branch**: `006-mentions`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Mentions support for Chatter, feature 006-mentions. Add a normalized, provider-agnostic mention model to @chatter/core and map Telegram mention entities onto it in @chatter/telegram. Core: a Mention type exposed on Message, a new 'mentions' Capability, and conformance-suite coverage in @chatter/testing so any future adapter must satisfy the same contract. A mention must carry its position in the text (offset/length), the literal mention text as it appears, and — when the provider can resolve it — a Participant. Telegram's 'mention' entity (@username) carries NO user id, while 'text_mention' carries a full User object, so the model must represent an unresolved mention without inventing an id. The model must express 'this account/bot was mentioned' so application code can trigger on being addressed without string-matching usernames itself. Telegram mapping: read message.entities for text messages and message.caption_entities for attachment captions — mapMessage currently reads neither. Handle 'mention', 'text_mention', and decide explicitly whether bot_command mentions (/cmd@botname) count. Document the UTF-16 code-unit offset convention Telegram uses and how it relates to JS string indexing. Out of scope: outbound mention formatting/sending, reactions, message edits/deletions, interactive components, Slack."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A developer receives mentions as structured data (Priority: P1)

A developer building on Chatter wants the people referenced in an incoming message to arrive as
structured, positioned data on the message they already handle — rather than having to re-parse
the message text themselves and guess at each provider's mention syntax.

**Why this priority**: Nothing else in this feature is usable until mentions actually reach the
application in normalized form. This is the foundation the remaining stories build on.

**Independent Test**: Deliver synthetic inbound messages containing each supported mention form
and confirm every one produces a correspondingly positioned mention on the dispatched message,
with no real provider credentials involved.

**Acceptance Scenarios**:

1. **Given** an incoming message whose text references one person, **When** it is delivered,
   **Then** the dispatched message carries exactly one mention.
2. **Given** an incoming message referencing several people, **When** it is delivered, **Then**
   the dispatched message carries one mention per reference, in the order they appear in the text.
3. **Given** any mention, **When** the application inspects it, **Then** it exposes the literal
   text as written and the position of that text within the message, such that extracting the
   text at that position returns exactly the mention as written.
4. **Given** a mention the provider can resolve to a specific person, **When** the application
   inspects it, **Then** it exposes that person in the same normalized participant form used
   everywhere else in Chatter.
5. **Given** a mention the provider cannot resolve to a specific person, **When** the application
   inspects it, **Then** the mention is still present with its text and position, and exposes no
   participant at all — rather than a participant with a fabricated or placeholder identifier.
6. **Given** an incoming message with no references to anyone, **When** it is delivered, **Then**
   the dispatched message carries no mentions, and is indistinguishable in that respect from
   messages handled before this feature existed.

---

### User Story 2 - A developer detects that their own account was addressed (Priority: P1)

A developer wants to know that *their* integration was the one being addressed in a message, so
they can act only when spoken to — without hard-coding their own account's name or writing
provider-specific string matching to find it.

**Why this priority**: "Only respond when addressed" is the single most common reason an
application cares about mentions at all. Delivering mentions without this leaves every consumer
to reimplement the same fragile name-matching logic that this feature exists to eliminate.

**Independent Test**: Deliver messages that address the connected account, that address a
different person, and that address no one, and confirm the addressed-account signal is set only
in the first case — verifiable without credentials by supplying a known account identity.

**Acceptance Scenarios**:

1. **Given** an incoming message that references the connected account, **When** it is delivered,
   **Then** the corresponding mention is marked as referring to the connected account.
2. **Given** an incoming message that references someone other than the connected account,
   **When** it is delivered, **Then** no mention is marked as referring to the connected account.
3. **Given** an incoming message that references both the connected account and other people,
   **When** it is delivered, **Then** only the mention of the connected account is marked as such.
4. **Given** an application that wants to act only when addressed, **When** it inspects a message,
   **Then** it can make that determination without comparing any name or handle text itself.

---

### User Story 3 - Mentions inside media captions are not lost (Priority: P2)

A developer wants a person referenced in the caption of a photo, video, or file to be reported
the same way as a person referenced in a plain text message.

**Why this priority**: A real and easily-missed gap — captions are a normal place to address
someone — but it is a second surface on top of a working mention model, not a prerequisite for it.

**Independent Test**: Deliver a captioned attachment whose caption references someone and confirm
the resulting message carries the mention, positioned relative to the caption text.

**Acceptance Scenarios**:

1. **Given** an incoming attachment whose caption references a person, **When** it is delivered,
   **Then** the dispatched message carries that mention alongside the attachment.
2. **Given** such a message, **When** the application uses a mention's position against the
   message's text, **Then** the position refers to the same text the message exposes — with no
   separate rule for captioned messages versus plain text messages.
3. **Given** an incoming attachment with no caption, **When** it is delivered, **Then** the
   dispatched message carries no mentions.

---

### User Story 4 - Mention support is honestly declared and contract-tested (Priority: P3)

A developer choosing or swapping providers wants to detect at runtime whether the provider they
are connected to reports mentions at all, and wants confidence that every provider reporting
support behaves the same way.

**Why this priority**: Required by the project's capability model and shared-conformance rules,
but it is a correctness and future-proofing concern rather than something a consumer of the
existing single provider feels on day one.

**Independent Test**: Inspect a mention-supporting and a non-mention-supporting adapter's declared
capabilities and confirm they differ, and run the shared conformance suite against both.

**Acceptance Scenarios**:

1. **Given** an adapter that reports mentions, **When** an application inspects its capabilities,
   **Then** mention support is listed.
2. **Given** an adapter that does not report mentions, **When** an application inspects its
   capabilities, **Then** mention support is absent, and the application can branch on that
   without checking the provider's name.
3. **Given** any adapter declaring mention support, **When** the shared conformance suite runs
   against it, **Then** it is required to satisfy the same mention behavior as every other
   adapter declaring that support.

---

### Edge Cases

- **Unresolvable reference**: a reference written as a handle, which the provider delivers with
  no underlying person identifier, is reported with text and position but no participant — never
  with a synthesized identifier (Story 1, scenario 5).
- **Text containing characters outside the basic multilingual plane** (emoji, some scripts): a
  mention's reported position must still isolate exactly the mention text when applied to the
  message text, including when such characters appear before the mention.
- **The same person referenced more than once**: each occurrence is reported separately, with its
  own position.
- **A reference to someone who has since left the conversation or deleted their account**: still
  reported; Chatter does not verify that a referenced person currently exists.
- **A message with an attachment and no caption**: no mentions, no error.
- **A message with no identifiable sender** (e.g. an automated channel post): mentions in its text
  are still reported; sender identity and mention extraction are independent.
- **A reference to the connected account written as a handle**: still recognized as addressing the
  connected account, by comparing against that account's own handle inside the adapter — even
  though the provider supplies no person identifier for that reference form.
- **A command naming the connected account** (`/command@botname`): produces no mention, and does
  not raise the addressed-account signal (FR-017).
- **The connected account's own identity cannot be determined** at connection time: connecting
  fails with a typed error; the adapter never runs in a state where the addressed-account signal
  is silently unavailable (FR-018).
- **A provider-supplied position that falls outside the message text** or overlaps another
  mention: treated as a malformed provider payload; the message must still be delivered rather
  than dropped or crashing the dispatch loop.
- **A message containing an unusually large number of references**: all are reported; no silent
  truncation to a fixed count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An inbound message MUST be able to carry an ordered collection of mentions,
  reflecting the order in which they appear in the message text.
- **FR-002**: A message with no mentions MUST remain indistinguishable from a pre-feature message
  in shape — absence of mentions MUST NOT be represented as an empty-but-present collection where
  a message previously carried nothing.
- **FR-003**: Every mention MUST expose the literal text of the reference as it appears in the
  message.
- **FR-004**: Every mention MUST expose its position within the message text, expressed such that
  applying that position to the message's own text yields exactly the mention's literal text.
- **FR-005**: The positional convention MUST be documented explicitly, including its behavior for
  text containing characters outside the basic multilingual plane.
- **FR-006**: A mention MUST expose a normalized participant when — and only when — the provider
  supplies enough information to identify that person.
- **FR-007**: A mention that the provider cannot resolve to a person MUST NOT expose a
  participant, and MUST NOT be assigned a placeholder, fabricated, or handle-derived identifier.
- **FR-008**: Every mention MUST indicate whether it refers to the connected account itself.
- **FR-009**: An application MUST be able to determine that a message addresses the connected
  account without performing any text or handle comparison of its own.
- **FR-010**: Mentions MUST be reported for references appearing in a media caption on the same
  terms as references appearing in plain message text, using positions relative to the text the
  message exposes.
- **FR-011**: Adapters MUST declare mention support through the capability model, and applications
  MUST be able to branch on it without inspecting the provider's name.
- **FR-012**: The shared conformance suite MUST cover mention behavior, so that any current or
  future adapter declaring mention support is held to the same contract.
- **FR-013**: The fake adapter used for provider-free testing MUST be able to produce messages
  carrying mentions, including resolved, unresolved, and self-referring ones.
- **FR-014**: Mention extraction MUST derive entirely from structured metadata supplied by the
  provider — Chatter MUST NOT scan, parse, or interpret message text to discover mentions the
  provider did not report.
- **FR-015**: A malformed or inconsistent mention payload from a provider MUST NOT prevent the
  message itself from being delivered.
- **FR-016**: The Telegram adapter MUST report mentions for both of Telegram's mention forms —
  the handle-only form and the form carrying a full user object — mapping each to a resolved or
  unresolved mention accordingly.
- **FR-017**: A command addressed to a specific bot (the `/command@botname` form) MUST NOT produce
  a mention. Providers mark this as a command construct, not as a reference to a person, and
  FR-014 forbids inferring a mention the provider did not report. Consequence, accepted
  deliberately: an application is not told it was addressed by `/command@botname` alone.
- **FR-018**: Establishing the connected account's own identity MUST be a precondition of a
  successful connection — if it cannot be determined, connecting MUST fail with a typed error
  rather than succeeding into a state where the addressed-account signal is silently never raised.
- **FR-019**: Documentation MUST state which mention forms a provider can and cannot resolve to a
  person, so consumers understand why some mentions carry no participant.
- **FR-020**: No provider credential, token, or secret may be required to test any mention
  behavior described in this specification.

### Key Entities

- **Mention**: A single reference to a person within a message's text. Carries the literal text of
  the reference, its position within that text, whether it refers to the connected account, and —
  when resolvable — the participant referenced. Belongs to exactly one message.
- **Message**: Gains an optional, ordered collection of mentions. Otherwise unchanged.
- **Participant**: Unchanged; reused as the identity a resolved mention points to.
- **Capability**: Gains a value representing mention support, declared per adapter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An application can act only when addressed without writing a single line of
  provider-specific or text-matching logic of its own.
- **SC-002**: Across the full matrix of supported mention forms × message surfaces (plain text and
  media caption), 100% of provider-reported references appear as mentions — zero silently dropped.
- **SC-003**: For every mention produced, applying its reported position to the message's own text
  returns exactly its reported literal text — verified across text containing plain ASCII,
  accented characters, and emoji.
- **SC-004**: Zero mentions are emitted with a fabricated or placeholder participant identifier.
- **SC-005**: Every adapter declaring mention support passes the shared conformance suite's
  mention coverage.
- **SC-006**: 100% of mention behavior is verifiable without any real provider account or
  credential.
- **SC-007**: Messages already handled correctly before this feature continue to be delivered
  unchanged, with no new required fields for applications that ignore mentions.

## Assumptions

- Only inbound mentions are in scope. Composing or formatting a mention on an outgoing message is
  explicitly excluded and left to a future feature.
- Mentions are derived solely from structured metadata the provider supplies alongside the
  message. This keeps the feature within Chatter's transport-only boundary: Chatter reports what
  the provider marked, and never interprets message content to infer additional references.
- Replying to the connected account is *not* treated as an implicit mention of it. Reply
  relationships are already modeled separately, and conflating the two would mean inventing
  mention semantics the provider did not report.
- A message's mention positions are relative to the single text value the message exposes,
  whether that text originated as message body or as a media caption. Applications never need to
  know which of the two it was in order to use a position.
- Where a provider reports a reference to a person the connected application has never seen,
  Chatter reports it as-is; resolving, enriching, or verifying that identity is the application's
  concern, not Chatter's.
- Identifying whether a mention refers to the connected account is a comparison performed inside
  the adapter against the connected account's own identity — no cross-provider identity matching
  is involved, consistent with the project's prohibition on identity merging.
- Mention data is message metadata subject to the same privacy posture as message content: it is
  passed through, never persisted by Chatter, and never logged.
- No changes to existing message, participant, or attachment behavior are required beyond adding
  the mention collection; this feature is additive to the normalized surface.
- The existing Telegram adapter's dedup, webhook validation, and error-mapping behavior are
  unaffected and remain as specified by features 002 and 003.
