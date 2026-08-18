# Feature Specification: Telegram Provider Adapter

**Feature Branch**: `002-telegram-adapter`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Build the Telegram provider adapter (@chatter/telegram) — Phase 2 from the roadmap. A host application must be able to register a real Telegram bot account with Chatter and communicate bidirectionally in both a direct chat and a group chat, using only the normalized Chatter API from ticket #1, with zero Telegram-specific logic in the host application."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Round-trip a message in a direct chat with a real bot (Priority: P1)

A developer who already built their message-handling logic against the fake account (ticket #1)
wants to point that exact same code at a real Telegram bot and have it work, in a one-on-one
chat with the bot, with no changes to their handler code.

**Why this priority**: This is the whole point of the ticket — proving the normalized contract
from ticket #1 holds up against a real, external, network-connected provider, not just the fake
one. Nothing else in this ticket matters if this doesn't work.

**Independent Test**: Configure a real Telegram bot's credentials, run the example application,
send it a direct message from a Telegram account, and confirm the bot replies — using the exact
handler code shape that already worked against the fake adapter in ticket #1.

**Acceptance Scenarios**:

1. **Given** a Telegram bot is configured and the host application's webhook endpoint is
   reachable by Telegram, **When** a person sends the bot a text message in a private chat,
   **Then** the application's handler receives one normalized message event whose conversation
   is reported as type "direct", with the correct sender and text.
2. **Given** that inbound message was just received, **When** the application replies using
   Chatter's normal send/reply call, **Then** the reply is visibly delivered back to that same
   Telegram chat as a reply to the original message.

---

### User Story 2 - The same code also works in a group chat (Priority: P1)

The same developer wants their bot, added to a Telegram group, to receive and reply to messages
in that group using the identical application code path as the direct-chat case — proving the
provider's differences (direct vs. group) are handled by the adapter, not by the application.

**Why this priority**: This is the literal exit criterion for this phase of the roadmap: the
same example application working across both conversation shapes by configuration alone. It's
inseparable in importance from Story 1 — a direct-only integration wouldn't validate the
group/channel side of the normalized conversation model at all.

**Independent Test**: Add the same configured bot to a Telegram group, send it a message in that
group, and confirm the identical example application (unmodified) replies in the group — with
the conversation now reported as type "group" instead of "direct".

**Acceptance Scenarios**:

1. **Given** the bot is a member of a Telegram group, **When** a message is sent in that group
   (addressed to the bot per Telegram's own group message-visibility rules), **Then** the
   application's handler receives a normalized message event whose conversation is reported as
   type "group", with the correct sender, text, and a conversation reference distinct from any
   direct chat.
2. **Given** that inbound group message was just received, **When** the application replies,
   **Then** the reply appears in that same group, without any group-specific code in the
   application beyond what already handled the direct-chat case.

---

### User Story 3 - Forged or missing webhook requests never reach application code (Priority: P2)

A developer running this in production wants confidence that only genuine requests from
Telegram can trigger their message-handling logic — not just anyone who discovers or guesses
their webhook URL.

**Why this priority**: This is a real security requirement (not a nice-to-have) for anything
exposed on the public internet, but it's ordered after Stories 1-2 because the happy path has to
exist before its guardrails are meaningful to verify.

**Independent Test**: Send a request to the webhook endpoint that omits or gets wrong the secret
Telegram is expected to include, and confirm it's rejected before the application's message
handler is ever invoked.

**Acceptance Scenarios**:

1. **Given** the webhook endpoint is live, **When** a request arrives without the expected
   secret, **Then** it is rejected and no message event is delivered to the application.
2. **Given** the webhook endpoint is live, **When** a request arrives with an incorrect secret,
   **Then** it is rejected the same way as a missing one, and no message event is delivered.
3. **Given** the webhook endpoint is live, **When** a request arrives with the correct secret,
   **Then** it is accepted and processed normally.

---

### User Story 4 - Failures are identifiable, not mysterious (Priority: P2)

A developer whose bot hits a real-world problem — a bad token, a chat that no longer exists, a
user who blocked the bot, or Telegram briefly rate-limiting the bot — wants to know which of
these happened from the shape of the error, not by inspecting a raw provider response, and wants
to know whether it's worth retrying automatically.

**Why this priority**: Ticket #1 already proved the typed-error concept end-to-end against the
fake account; this story is "prove the real adapter actually classifies its own real failures
correctly," which only matters once the happy path (Stories 1-2) exists to fail meaningfully.

**Independent Test**: Deliberately trigger each failure condition (bad token, message to an
unreachable chat, and a simulated rate-limit response) and confirm each produces a distinct,
correctly-typed failure — with the rate-limit case indicating whether retrying may help.

**Acceptance Scenarios**:

1. **Given** an invalid bot token, **When** the adapter is started or a send is attempted,
   **Then** the failure is identifiable as an authentication problem.
2. **Given** a send targets a chat the bot cannot reach (never started, or the bot was removed/
   blocked), **When** the send is attempted, **Then** the failure is identifiable as an
   invalid-target problem, not a generic failure.
3. **Given** Telegram responds with a rate-limit / flood-control response, **When** a send is
   attempted, **Then** the failure is identifiable as a rate-limit problem and indicates whether
   retrying may succeed.
4. **Given** the adapter reports what it supports, **When** the application checks in advance,
   **Then** it accurately reports support for text and replies, and accurately reports that it
   does not support threads — never claiming a feature this adapter doesn't actually have.

---

### User Story 5 - The adapter is provably compliant with the shared contract, without live credentials (Priority: P3)

A developer maintaining this codebase (or building the next provider adapter after this one)
wants assurance that the Telegram adapter honors the same contract every adapter must honor, and
wants the full test suite to run in CI without needing a real Telegram bot token as a secret.

**Why this priority**: This closes the loop opened by ticket #1's conformance suite — it's the
proof that the suite generalizes beyond the fake adapter, which is valuable but not
blocking for the ticket's actual user-facing outcome (Stories 1-2 already deliver that).

**Independent Test**: Run the existing shared conformance suite from ticket #1, unmodified,
against this adapter, and separately run this adapter's full test suite with no real Telegram
credentials present, confirming both succeed.

**Acceptance Scenarios**:

1. **Given** the shared conformance suite from ticket #1, **When** it's run against this
   adapter, **Then** every check passes with no suite-level changes and no adapter-specific
   exceptions or skips.
2. **Given** a clean environment with no real Telegram bot token configured, **When** this
   adapter's automated test suite runs, **Then** it completes successfully using only recorded
   or synthetic provider payloads.

---

### Edge Cases

- What happens if a message arrives in a group chat that mentions or is a reply to the bot vs.
  one that isn't addressed to the bot at all? (Telegram's own group-visibility privacy rules
  determine what the bot even receives; the adapter normalizes whatever it's given and doesn't
  need to guess at messages it never receives.)
- What happens if the webhook endpoint receives a well-formed, correctly-authenticated request
  for an update type this ticket doesn't support (e.g., an edited message, a reaction)? (Must be
  safely ignored — acknowledged so Telegram doesn't retry it, but not turned into a message
  event.)
- What happens if `stop()` is called and the webhook was never successfully registered (e.g.
  `start()` never completed)? (Must not throw or leave a dangling registration.)
- What happens if two different bot tokens are configured as two separate accounts in the same
  process? (Each must operate independently — an inbound update for one bot's webhook must never
  be attributed to the other's account.)
- What happens if the bot token or webhook secret would otherwise appear in a thrown error's
  message or a log line (e.g., an HTTP client library's default error formatting includes the
  request)? (Must be scrubbed/never included, at every log level.)
- What happens when a reply is requested to a message that Telegram itself has since deleted?
  (Must surface as an identifiable invalid-target failure, not a silent no-op or a generic
  error.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The adapter MUST accept a bot token and a webhook secret as configuration,
  supplied by the host application, and MUST NOT log either at any point or in any error output.
- **FR-002**: The adapter MUST expose a framework-independent webhook request handler that a
  host application wires into its own HTTP server to receive Telegram updates.
- **FR-003**: The adapter MUST reject any webhook request that does not present the correct
  configured secret, before normalizing or dispatching anything from that request, using a
  comparison method that does not leak timing information about the correct value.
- **FR-004**: Starting the adapter MUST register the webhook with Telegram; stopping it MUST
  remove that registration.
- **FR-005**: The adapter MUST normalize inbound text messages from both direct (private) chats
  and group chats into the shared message/event model, correctly reporting the conversation as
  "direct" or "group" respectively.
- **FR-006**: The adapter MUST allow sending a text message and replying to a specific prior
  message, returning a normalized delivery result on success.
- **FR-007**: The adapter MUST accurately declare its supported capabilities: text and reply
  are supported; thread is not.
- **FR-008**: The adapter MUST map at least the following real-world failure conditions to the
  correspondingly typed error from the shared error hierarchy: invalid/revoked credentials,
  an unreachable or nonexistent conversation target, and provider-side rate limiting — the
  rate-limiting case MUST indicate whether retrying may succeed.
- **FR-009**: The adapter MUST pass the existing shared adapter conformance suite unmodified.
- **FR-010**: The adapter's automated test suite MUST be runnable and MUST pass with no real
  provider credentials present.
- **FR-011**: Setup documentation MUST cover creating a bot, obtaining a token, configuring the
  webhook (including guidance for exposing a local development server to the public internet),
  required permissions, supported capabilities, and known limitations.
- **FR-012**: A provider-backed example application MUST demonstrate the identical handler code
  working across both a direct chat and a group chat, configured against this adapter.
- **FR-013**: Well-formed, authenticated webhook requests describing an update type this ticket
  does not normalize (e.g., an edit or a reaction) MUST be safely acknowledged without being
  turned into a message event or causing an error.
- **FR-014**: Multiple independently configured bot accounts MUST operate in one process without
  inbound updates or outbound sends from one ever being attributed to another.

### Key Entities

- **Bot account configuration**: The credentials (token, webhook secret) and settings a host
  application supplies to connect one Telegram bot to Chatter. Distinct per bot; never persisted
  or logged by the adapter itself.
- **Webhook request**: An inbound HTTP request from Telegram carrying an update. Must be
  authenticated before anything else happens to it.
- **Update**: Telegram's term for an inbound event; this ticket only turns "new text message"
  updates into normalized message events, safely ignoring other update types it doesn't yet
  support.
- **Chat**: Telegram's term for a conversation; may be a private (direct) chat or a group,
  mapped onto the shared conversation model with the correct type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The identical example application code replies correctly to a message sent to the
  bot in a direct chat and to a message sent to the bot in a group chat, with no
  conversation-type-specific branching in the application code itself.
- **SC-002**: 100% of webhook requests lacking the correct secret are rejected before reaching
  application handlers, verified across both a missing-secret and a wrong-secret case.
- **SC-003**: Each of the three failure conditions in FR-008 is independently triggerable and
  produces a distinguishable, correctly-typed result in tests.
- **SC-004**: The full non-live automated test suite for this adapter passes with zero real
  Telegram credentials, in under 2 minutes on a typical development machine.
- **SC-005**: The shared conformance suite from ticket #1 passes against this adapter with zero
  modifications to the suite itself.
- **SC-006**: A new contributor can follow the setup documentation from having no bot at all to
  a running example bot answering direct and group messages, without needing to ask a human for
  any undocumented step.

## Assumptions

- "Group chat" in this ticket refers to a standard Telegram group (or supergroup); Telegram's
  separate "channel" chat type and "topics" (forum threads within a supergroup) are out of scope
  and may be addressed in a later phase alongside the broader capability model.
- The example application from ticket #1 (fake-adapter-based) is extended or paralleled with a
  Telegram-backed variant for this ticket, rather than replaced — both remain useful references.
- Local development against a real Telegram bot requires exposing a local server to the public
  internet (a tunnel); this is a documented manual setup step for contributors, not something
  the adapter or its tests automate.
- "No real credentials in CI" means the adapter's own automated test suite (unit, integration
  against recorded/synthetic payloads, and the shared conformance suite) is what runs in CI;
  manual verification against a real bot (Stories 1-2's actual acceptance) is performed locally
  by a human, the same way UI/E2E testing is treated elsewhere in this project.
- Telegram's Bot API is assumed reachable over the network for the adapter's outbound calls;
  handling sustained Telegram-side outages gracefully beyond returning an identifiable
  provider-unavailable failure is not required by this ticket.
