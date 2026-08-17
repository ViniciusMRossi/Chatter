# Feature Specification: Core Package Foundation

**Feature Branch**: `001-core-foundation`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Build the Chatter core package foundation — Phase 1 from the roadmap. A host application must be able to receive and send normalized text messages entirely through a fake adapter, with no real provider involved, validating the core architecture before any real provider integration begins."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Round-trip a text message with no real provider (Priority: P1)

A developer integrating Chatter into their application wants to write and run their
message-handling logic — receive a message, decide on a reply, send it back — without needing
credentials for, or a network connection to, any real messaging platform.

**Why this priority**: This is the architecture-validating slice the whole phase exists to prove.
If a message can't round-trip through the normalized model and back out again with no real
provider involved, nothing else in the roadmap can be trusted to work either.

**Independent Test**: Register a fake provider account, start the library, simulate an inbound
text message on that fake account, and confirm the application's handler receives a fully
normalized message (with sender, conversation, and provider message ID). Send a text reply
through the library and confirm the fake account records exactly what was sent, to the right
conversation.

**Acceptance Scenarios**:

1. **Given** a fake account is registered and the library has been started, **When** the fake
   account emits an inbound text message, **Then** the application's handler receives one
   normalized message event containing the provider name, account name, sender reference,
   conversation reference (with its type), message text, timestamp, and a stable provider
   message ID.
2. **Given** a normalized inbound message was just received, **When** the application sends a
   text reply targeting that same message, **Then** the reply is delivered to the correct
   conversation on the correct account, and the delivery result returned to the application
   contains a provider message reference, the conversation reference, and a timestamp.
3. **Given** the library has not been started, **When** the application attempts to send a
   message, **Then** the send fails with a clear, typed error rather than silently doing nothing
   or hanging.

---

### User Story 2 - Run multiple accounts in one process without collisions (Priority: P2)

A developer wants to configure more than one account (for example, two different bots, or the
same fake provider configured twice under different names) in a single running application, and
have messages and replies stay correctly attributed to the right account.

**Why this priority**: Real deployments commonly run several bot accounts at once (see FR-014 in
the product requirements). If account isolation isn't correct at the foundation stage, every
later provider adapter inherits the bug.

**Independent Test**: Register two fake accounts under distinct application-level names, start
the library, send a distinct inbound message on each account, and confirm each is delivered to
the handler tagged with the correct account — never mixed up — and that a reply sent "from"
one account is never observable as coming from the other.

**Acceptance Scenarios**:

1. **Given** two fake accounts are registered under different application-level names, **When**
   each receives its own inbound message, **Then** the application's handler can tell, for each
   event, exactly which account it came from.
2. **Given** two fake accounts are registered, **When** the application sends a reply "from"
   account A, **Then** the message is recorded as sent by account A only, never by account B.
3. **Given** an application attempts to register two accounts under the same application-level
   name, **When** registration is attempted, **Then** the library rejects it with a clear,
   typed configuration error instead of silently overwriting the first registration.

---

### User Story 3 - Understand failures and capabilities without guessing (Priority: P3)

A developer wants to know, in code, why an operation failed (bad configuration vs. a transient
provider issue vs. an unsupported feature) and whether a given account can even do what they're
about to ask it to do, before or instead of finding out by trial and error in production.

**Why this priority**: This is what makes the library production-usable rather than a toy — but
it builds on top of Stories 1 and 2 rather than blocking them, so it's ordered after basic
round-tripping and multi-account correctness are proven.

**Independent Test**: Attempt operations designed to fail in each category (unregistered
conversation, simulated rate limit, requesting a capability the fake account doesn't declare)
against the fake account, and confirm each produces a distinct, identifiable failure type with
enough information to decide whether retrying makes sense — without needing to inspect a raw
provider error message.

**Acceptance Scenarios**:

1. **Given** a fake account configured to simulate a rate-limit response, **When** a send is
   attempted against it, **Then** the failure is identifiable as a rate-limit error and indicates
   whether retrying may succeed.
2. **Given** a fake account, **When** the application asks what it supports before sending,
   **Then** it can determine in advance whether a given feature (e.g. threaded replies) is
   available on that account, without attempting the operation first.
3. **Given** a send targets a conversation reference that does not exist on the fake account,
   **When** the send is attempted, **Then** the failure is identifiable as an invalid-target
   error, distinct from a rate-limit or authentication error.

---

### User Story 4 - Prove a new adapter meets the contract before shipping it (Priority: P4)

A developer building a new provider adapter (starting with the fake one, and later a real one)
wants a ready-made way to verify their adapter behaves the way every other adapter is expected
to, without having to invent their own test suite from scratch or guess what "correct" means.

**Why this priority**: This doesn't block getting the fake adapter working (Stories 1-3), but
without it, "the contract" is just documentation nobody checks — this is what makes it
enforceable, and what every later provider adapter (Telegram next) will be validated against.

**Independent Test**: Run the shared conformance checks against the fake adapter with no
modification to the checks themselves, and confirm they pass; confirm the checks would fail if
the fake adapter were deliberately broken (e.g. dropping the conversation reference on inbound
messages), proving the checks actually test something.

**Acceptance Scenarios**:

1. **Given** the fake adapter implements the full adapter contract, **When** the shared
   conformance checks are run against it, **Then** all checks pass without any fake-adapter-
   specific exceptions or skips.
2. **Given** the fake adapter is deliberately modified to omit a required piece of normalized
   data, **When** the conformance checks are run again, **Then** the checks fail and identify
   which contract requirement was violated.

---

### Edge Cases

- What happens if the library is started twice without stopping in between? (Must not double-
  register handlers or duplicate inbound events.)
- What happens if stop() is called before start(), or twice in a row? (Must not throw or leave
  the process in an inconsistent state.)
- What happens if an inbound event arrives after stop() has been called? (Must not be delivered
  to application handlers.)
- What happens if the fake adapter emits the same inbound event twice (duplicate delivery)? (The
  application must be able to detect the duplicate via a stable event/message ID; the library
  itself is not required to suppress it durably.)
- What happens if an application handler throws or never resolves while processing an inbound
  event? (Must not crash the process or silently stall delivery of unrelated events to other
  handlers/accounts.)
- What happens if a send is attempted with an empty or excessively long message body? (Must fail
  predictably with a typed error rather than an unhandled exception.)
- What happens if a reply is sent targeting a message ID that was never seen (e.g. from a
  different account)? (Must fail as an invalid-target error.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The library MUST allow an application to register one or more accounts, each
  under a unique application-level name, before starting.
- **FR-002**: The library MUST reject registration of two accounts under the same
  application-level name with a typed configuration error.
- **FR-003**: The library MUST provide a start operation that brings all registered accounts
  online and a stop operation that cleanly shuts all of them down, releasing any held resources.
- **FR-004**: The library MUST deliver inbound text messages to application-provided handlers as
  a normalized message event, identifying provider, account, sender, conversation (including its
  type: direct, group, channel, or unknown), message text, timestamp, and a stable provider
  message ID.
- **FR-005**: The library MUST allow an application to send a normalized text message to a
  specified conversation on a specified account, and to target a reply to a specific prior
  message when the account supports it.
- **FR-006**: Every outbound send MUST return a normalized delivery result containing a provider
  message reference, the conversation reference, and a timestamp when available.
- **FR-007**: The library MUST expose a way for an application to query, per account, which
  features (e.g. threaded replies) are supported, before attempting to use them.
- **FR-008**: The library MUST expose distinguishable, typed failures for at least:
  invalid configuration, authentication problems, authorization problems, rate limiting,
  invalid send targets, unsupported feature requests, provider unavailability, and unknown
  failures.
- **FR-009**: Rate-limit and other transient failures MUST indicate whether retrying may succeed.
- **FR-010**: The library MUST support at least two simultaneously registered accounts in one
  running process without messages, replies, or errors from one account ever being attributed to
  another.
- **FR-011**: The library MUST provide a fake account implementation, usable with no network
  access or real credentials, sufficient to exercise every other requirement in this
  specification.
- **FR-012**: The library MUST provide a shared, reusable set of conformance checks that any
  account implementation (starting with the fake one) can be run against to verify it honors the
  contract described in FR-001 through FR-010.
- **FR-013**: All behavior described in this specification MUST be verifiable through automated
  tests that require no real provider account, credential, or network access.
- **FR-014**: The library MUST NOT persist message content or participant data by default, and
  any temporary in-memory buffering it performs (e.g. for duplicate-event awareness) MUST be
  bounded and documented rather than acting as durable storage.

### Key Entities

- **Account**: A configured, named connection point registered by the application (in this
  phase, always the fake implementation). Uniquely identified within the running process by its
  application-level name.
- **Participant**: A person, bot, or system actor who can send or receive messages within an
  account's conversations. Identified by an opaque, account-scoped reference.
- **Conversation**: The place messages are exchanged — direct, group, channel, or unknown.
  Identified by an opaque, account-scoped reference; the reference an application should use as
  the key for its own shared state or memory.
- **Message**: A single normalized unit of communication: who sent it, in which conversation,
  what it said, when, and (optionally) what earlier message it replies to.
- **Event**: An occurrence delivered to the application — in this phase, limited to "a message
  was created."
- **Delivery Result**: What the library hands back after a successful send — enough for the
  application to know what was sent, where, and when.
- **Capability**: A named feature (e.g. threaded replies) an account either does or does not
  support, queryable in advance of attempting to use it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can write and run a complete send/receive round trip against the fake
  account, from an empty project, without configuring anything beyond in-process code — no
  network calls, credentials, or external services involved.
- **SC-002**: 100% of the failure categories listed in FR-008 are independently
  triggerable and distinguishable in tests, with no category producing an error indistinguishable
  from another.
- **SC-003**: Running the shared conformance checks against the fake account completes with zero
  failures, and deliberately breaking any single contract requirement in the fake account causes
  at least one conformance check to fail.
- **SC-004**: The full automated test suite for this phase (unit tests, conformance checks) runs
  to completion with no real provider account, credential, or network access, in under 2 minutes
  on a typical development machine.
- **SC-005**: Sending two messages on two different accounts concurrently never results in a
  message, reply, or delivery result being attributed to the wrong account, across repeated test
  runs.

## Assumptions

- "Text message" is the only message content type in scope for this phase; attachments,
  reactions, edits, and deletions are out of scope here and covered in later phases per the
  roadmap.
- The fake account is an in-memory implementation only — it does not simulate network latency,
  partial failures, or reconnect behavior, since those concerns belong to real, connection-based
  adapters built in later phases.
- "Application handler" refers to a function the host application supplies to receive inbound
  events; the exact shape of that function (callback vs. another consumption style) is a
  technical design decision made in the planning phase, not this specification.
- No real provider (Slack, Discord, Telegram, WhatsApp) is touched, configured, or required by
  this phase; the first real provider is planned as its own, separate feature.
- Durable deduplication of duplicate inbound events is explicitly an application concern, not
  this library's — this phase only requires that duplicates are detectable, not suppressed.
- This phase targets a single running process; multi-process or distributed coordination between
  accounts is out of scope.
