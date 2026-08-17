<!--
Sync Impact Report
Version change: none → 1.0.0 (initial ratification)
Modified principles: n/a (first adoption)
Added sections:
  - Core Principles: I. Transport-Only Boundary, II. Adapter Isolation & Extensibility,
    III. Capabilities Over False Parity, IV. Test-First, Contract-Tested,
    V. Typed, Explicit Contracts, VI. Security & Privacy By Default,
    VII. Independent Semantic Versioning
  - Additional Constraints (stack/privacy delegation to living docs)
  - Development Workflow (SDD cycle, commits, review, security tiers)
  - Governance
Removed sections: n/a (first adoption)
Deferred/TODO placeholders: none
Templates requiring follow-up: none — plan/spec/tasks templates are generic and read
  this constitution at runtime; no edits needed for this ratification.
-->

# Chatter Constitution

## Core Principles

### I. Transport-Only Boundary (NON-NEGOTIABLE)

Chatter normalizes and transports messages and events between messaging providers and a host
application. It MUST NOT interpret, classify, moderate, or summarize message content; call an
LLM or provide an LLM abstraction; build prompts or manage context-window limits; own
conversational memory, message history, or embeddings; or decide whether identities from
different providers represent the same real-world person. Any pull request that adds content
interpretation, an LLM dependency, or cross-provider identity merging to `@chatter/core` or any
adapter package MUST be rejected outright, not merged with a caveat.

Rationale: Chatter's entire value proposition is being safe, boring transport infrastructure
that any application logic — including an LLM-driven one — can sit behind without inheriting
platform-specific behavior. Blurring this boundary once makes every future consumer's business
logic implicitly load-bearing on Chatter internals, defeating the point of the library.

### II. Adapter Isolation & Extensibility

Every provider integration MUST ship as an independently installable package (`@chatter/slack`,
`@chatter/discord`, `@chatter/telegram`, `@chatter/whatsapp`, and any future provider) that
implements the shared adapter contract exported by `@chatter/core`. `@chatter/core` MUST NOT
import a provider SDK, provider-specific types, or provider-specific configuration directly.
A third party MUST be able to implement and publish a new adapter without modifying
`@chatter/core`.

Rationale: Applications should not need to install SDKs for providers they don't use
(modular installation), and the contract must be provable independent of any single vendor's
API shape — if core can only be validated against providers it directly imports, the
"contract" is fictional.

### III. Capabilities Over False Parity

Adapters MUST report supported capabilities (text, threads, reactions, editing, interactive
components, attachments, etc.) rather than Chatter simulating a feature a provider does not
actually support. Applications MUST detect provider differences through the capability model at
runtime, not through provider-name checks or documentation alone.

Rationale: Slack, Discord, Telegram, and WhatsApp do not offer equivalent feature sets. Faking
parity produces adapters that silently no-op or throw in production; an explicit capability
model makes the gap visible and testable instead.

### IV. Test-First, Contract-Tested

Core behavior MUST be testable, and tests MUST be written before or alongside implementation —
not backfilled after. `@chatter/testing` MUST provide a fake adapter and a conformance test
suite; core behavior tests MUST run without any real provider account or credential. No adapter
may be described as "stable" until it passes the shared conformance suite and ships its own
documented integration tests.

Rationale: A multi-provider library without provider-independent tests and a shared conformance
suite cannot prove the abstraction actually holds — it can only prove that whichever adapter was
tested by hand happens to work today.

### V. Typed, Explicit Contracts

All public APIs and adapter contracts MUST be authored in TypeScript strict mode and ship type
declarations. Errors MUST be typed and categorized (configuration, authentication,
authorization, rate limiting, invalid target, unsupported capability, provider unavailable,
unknown provider failure) rather than thrown as generic `Error` instances. Rate-limit and
transient errors MUST expose whether a retry may succeed and, when the provider supplies it, a
retry-after duration.

Rationale: Consumers build production message-handling logic against these contracts; untyped
or generic errors force every host application to re-derive provider-specific error handling
that Chatter exists to eliminate.

### VI. Security & Privacy By Default

Webhook adapters MUST validate provider signatures using timing-safe comparison before emitting
any event. Secrets (tokens, signing secrets, API keys) MUST NEVER be logged at any log level,
in any environment. Chatter MUST NOT persist message content or participant data by default;
any temporary in-memory buffering (e.g. duplicate-event suppression) MUST be bounded,
time-limited, and documented — never presented as durable storage. Raw provider payload or
metadata exposure MUST be opt-in and documented as potentially sensitive.

Rationale: Chatter sits directly in the path of user messages and provider credentials across
every integrating application; a default-secure, default-private posture here protects every
downstream consumer at once, and a lapse here is not recoverable after the fact the way an
application-level bug is.

### VII. Independent Semantic Versioning

Normalized API changes in `@chatter/core` MUST follow semantic versioning. Each adapter package
MUST declare the range of `@chatter/core` versions it is compatible with. Provider-specific
additions may release independently of core as long as declared compatibility is maintained.
Experimental capabilities and provider-specific extensions MUST be marked explicitly as such,
not folded silently into the normalized surface.

Rationale: Core and adapters are published as separate packages on independent timelines;
without an explicit compatibility contract, a core release can silently break every adapter at
once, or an adapter release can silently assume a core version its users don't have.

## Additional Constraints

Concrete stack choices (language, runtime, module format, package manager, test framework, first
adapter) and privacy/data-handling rules are maintained as living documents, not duplicated here:

- `Docs/Tech-Stack-Constitution.md` is authoritative for approved tools and the substitution
  log. Agents MUST check it before making a stack decision and MUST log any deviation there,
  with rationale, before using an alternative.
- `Docs/Privacy-Compliance.md` is authoritative for data-handling rules and the data inventory.
  Agents MUST check it before implementing anything that touches personal data.

Both documents implement Principle VI and MUST NOT contradict it; if a proposed stack or data
decision would require violating Principle VI, the principle wins and the proposal is rejected
or renegotiated, not silently accommodated.

## Development Workflow

Chatter is built using the Spec-Driven Development cycle documented in `AGENTS.md` and this
repository's `GETTING-STARTED` process: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`
→ `/speckit.taskstoissues` → `/speckit.implement`. Within implementation, the required order is
tests → code → passing tests → documentation, committed in small, individually reviewable
increments rather than one large commit at the end of a ticket.

Every pull request MUST pass Tier 1 security (Semgrep + secrets scan, automated in CI) before
merge. Tier 2 security (Shannon, whitebox pentest-style scan) is human-triggered only, reserved
for major releases or changes touching auth, payments, or data boundaries; an agent's role is
limited to flagging that a change looks like it warrants one, never running it. A human MUST
review and approve every pull request before merge; if the standard tool documented in
`Docs/Tech-Stack-Constitution.md` does not fit a ticket, the agent MUST stop and propose an
alternative — logged there with rationale — before proceeding, not after.

## Governance

This constitution supersedes ad hoc practice for any conflict between it and informal team
convention. Amendments require: a documented rationale, an explicit version bump per the policy
below, and update of the Sync Impact Report at the top of this file in the same change.

Versioning policy for this document:
- MAJOR: a principle is removed or redefined in a backward-incompatible way (e.g. loosening the
  Transport-Only Boundary or Adapter Isolation principles).
- MINOR: a new principle or materially expanded section is added.
- PATCH: wording, typo, or non-semantic clarification.

Any exception to Principle I (Transport-Only Boundary) or Principle II (Adapter Isolation &
Extensibility) requires explicit human sign-off (Tech Lead or Product Owner) documented in the
pull request description — an agent MUST NOT decide unilaterally to relax either principle, even
temporarily. All other pull requests are expected to comply with every principle above by
default; reviewers verify compliance as part of normal review, not as a separate gate.

**Version**: 1.0.0 | **Ratified**: 2026-08-17 | **Last Amended**: 2026-08-17
