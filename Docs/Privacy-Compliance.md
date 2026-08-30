# Privacy and Compliance

Owned by the human acting as Privacy/Compliance Engineer.

This is an **engineering privacy and data-boundary document, not legal advice**. It records the
data-handling rules that the Chatter architecture already establishes, so that agents and reviewers
can apply them operationally.

Do not assume a jurisdiction or compliance regime merely from the scaffold. Record only what
applies to this project.

Authorities behind this document:

- [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) — Principles I, IX, XI,
  XII, XIII;
- [`Architecture/Project-Context.md`](Architecture/Project-Context.md) — §6, §16, §17, §25A;
- [`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) — §30, §31;
- [`Architecture/Core-Contract.md`](Architecture/Core-Contract.md) — §9, §10;
- [`Architecture/Cross-Provider-Core-Mapping.md`](Architecture/Cross-Provider-Core-Mapping.md) §4A;
- [`Architecture/Decisions/WhatsApp-Customer-Service-Window.md`](Architecture/Decisions/WhatsApp-Customer-Service-Window.md).

Where those documents define a specific requirement, this file points at it rather than creating a
competing policy. If this file appears to conflict with the constitution or a frozen architecture
record, that conflict requires human resolution.

## Applicable regimes

**Not yet determined.** No authoritative Chatter record establishes a jurisdiction or regulatory
regime, and none is assumed here. This list is a human Privacy/Compliance Engineer decision and
must be settled before Chatter processes real end-user data in a deployment.

- [ ] LGPD
- [ ] GDPR / EEA
- [ ] UK GDPR
- [ ] CCPA / CPRA
- [ ] PIPEDA
- [ ] Australia Privacy Act
- [ ] Other:

The engineering rules in the rest of this document apply regardless of which regime is selected.

## Personal data inventory

Chatter is transport/integration infrastructure. It processes the categories below **in transit and
in process**; it does not own a store for any of them (constitution Principle I and IX). Retention,
deletion, and subject-rights paths therefore belong to the consuming application and its deployment,
not to the library.

| Category | Source | Purpose | Storage | Retention | Access | Deletion path |
|---|---|---|---|---|---|---|
| Provider-native identifiers (conversation/participant/message ids; WhatsApp ids may be phone numbers) | Inbound provider payloads; application-supplied refs | Entity identity, operation targeting | None in Chatter — in-process only; refs may be persisted by the consuming application as identity keys | Application-owned | Server-side process; redacted/hashed in default diagnostics | Application-owned |
| Message content (text, structured parts, provider extensions) | Inbound provider payloads; outbound application sends | Normalization, delivery | None in Chatter | Application-owned | Server-side process and event handlers | Application-owned |
| Participant snapshots (display name, username, bot flag) | Inbound provider payloads only, never implicit lookup | Message normalization | None in Chatter | Application-owned | Server-side process | Application-owned |
| Attachment/media bytes | Provider media retrieval | Transport only — streamed, not stored or re-hosted | None in Chatter | Not applicable — no caching or storage | Server-side retrieval | Not applicable |
| Raw provider payloads (`raw`, `native`) | Provider events/SDK | Diagnostics and escape hatch | None in Chatter | Application-owned | Server-side; excluded from default logs | Application-owned |
| Provider credentials, tokens, webhook secrets | Deployment secret mechanism | Provider authentication and webhook verification | Deployment secret store — never in source control | Deployment-owned | Server-side only | Deployment-owned |

Deployment-specific inventory rows (who operates the app, which providers are live, where data
lands) are **not determined** by any Chatter record and remain a human task before production use.

## Project rules

- **Consent / lawful basis:** not determined. Depends on the deployment and the regime selected
  above; no Chatter record establishes one.
- **Retention:** Chatter retains nothing. It maintains no conversation database, no message
  history, no reaction store, and no media cache. Deployment retention is application-owned and not
  determined here.
- **Deletion / subject rights:** Chatter has no owned store and therefore no deletion path of its
  own. Subject-rights fulfilment belongs to the application that persists conversation data.
- **Data residency:** not determined. Depends on the provider and deployment.
- **Cross-border transfer basis:** not determined. Depends on the provider and deployment.
- **Logging/redaction:** fully specified below and in
  [`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) §30 and
  [`Architecture/Project-Context.md`](Architecture/Project-Context.md) §25A. This is the one row
  that Chatter's architecture does fix.
- **Incident/breach handling:** not determined. Human process decision.

## Provider credentials and secrets

Provider credentials, access tokens, refresh material, SDK client instances, webhook signing
secrets, and equivalent authentication material MUST:

- remain server-side;
- never be exposed to the browser or to the example client;
- never appear in default logs, error serialization, or diagnostics;
- never be committed to source control or to tracked configuration;
- be supplied through the project/runtime secret mechanism rather than application code.

Live provider credentials belong only in protected CI jobs
([`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) §23).

No specific secret-management service is chosen by any authoritative Chatter record. Selecting one
is a deployment decision and is deliberately not invented here.

## Provider-native identifiers and PII

Provider-native identifiers can contain or directly encode personal data. In particular, **WhatsApp
direct-conversation identifiers may be customer phone numbers**
([`Architecture/Cross-Provider-Core-Mapping.md`](Architecture/Cross-Provider-Core-Mapping.md) §4A).

Consequences:

- Canonical refs are **stable identity and storage keys, not safe log strings**.
- Canonical refs and provider ids MUST NOT be assumed safe for unrestricted logging, metrics
  labels, browser URLs, or error payloads that leave the server.
- Where an identifier is needed for diagnostics, use the architecture's approved approach —
  **redact or hash the provider-native `id` and `conversationId`** rather than emitting raw values
  ([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §25A).
- Browser-facing application routing should use an application-safe opaque route key rather than a
  raw canonical ref
  ([`Architecture/Example-Client-Implementation-Notes.md`](Architecture/Example-Client-Implementation-Notes.md)).

Chatter does not replace provider-native ids with synthetic UUIDs; identity fidelity is a frozen
rule (constitution Principle V). Redaction is a logging/diagnostics concern, not an identity change.

## Message content and payloads

Default production logging MUST NOT contain:

- message bodies;
- attachment contents;
- access tokens or authorization headers;
- webhook secrets;
- raw provider payloads containing user data;
- raw canonical refs when they expose PII.

Diagnostics that genuinely need sensitive provider payloads MUST be deliberate, narrowly scoped,
explicitly enabled, and outside normal logging behavior. A diagnostics tap, if exposed, is
documented as diagnostics-grade and outside normal compatibility guarantees
([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §15).

Error serialization follows the same boundary: `toJSON()` excludes `cause` by default, and provider
HTTP objects and authorization headers are never serialized to browser clients
([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §17).

## Browser boundary

- The example client and any browser-facing application interact through Chatter and their own
  application APIs.
- Provider credentials and provider SDK clients MUST NEVER reach browser code.
- The example client MUST NOT bypass Chatter to call providers directly for convenience
  (constitution Principle XII).
- Provider-authenticated or temporary raw media URLs MUST NOT become the browser-facing media
  contract; media reaches the browser through the server/Chatter retrieval path
  (constitution Principle XI, [`Architecture/Core-Contract.md`](Architecture/Core-Contract.md) §9).
- Serialized Chatter errors received in an environment without provider packages must deserialize
  to a generic remote error preserving safe `code`, `category`, and metadata only.

## Persistence boundary

Chatter does not own long-term application conversation persistence. Applications own business
state and conversation persistence (constitution Principle I).

Do not introduce message, history, participant, or reaction storage into Chatter for:

- UI convenience;
- retry bookkeeping;
- customer-service-window tracking;
- unread state, drafts, or local search;
- conversation ordering.

Reaction data is event plus provider-supplied snapshot, never a Chatter-maintained live store.
Media is streamed transport with no caching or re-hosting.

## WhatsApp customer-service window

Frozen rule, preserved unchanged
([`Architecture/Decisions/WhatsApp-Customer-Service-Window.md`](Architecture/Decisions/WhatsApp-Customer-Service-Window.md),
constitution Principle IX):

- Chatter does **not** persist, cache, or maintain conversation history to calculate the 24-hour
  customer-service window, and maintains no `lastInboundAt` shadow state;
- **the provider is authoritative** for whether a free-form send is currently permitted;
- provider rejection is mapped through the approved provider-policy error contract:
  `ProviderPolicyError`, code `WHATSAPP_CUSTOMER_SERVICE_WINDOW_EXPIRED`, `retryable = false`,
  mapped from stable provider error codes/structure rather than message text;
- Chatter does not silently switch the caller to a template send.

An application that already stores its own history may predict the window state. That remains
application logic and does not move data ownership into Chatter.

## Logging and observability

Logging distinguishes useful diagnostics from data exposure. Capture operational information such
as:

- operation name;
- provider;
- Chatter-configured `accountId` (account context that is safely representable);
- `correlationId`, generated by Core at a logical operation or inbound-event boundary and
  propagated through descendant events, errors, and log records;
- normalized error `code` and `category`;
- retryability information (`retryable`, `retryAfterMs`).

Emit these **without** the protected content and credentials listed above, and with provider-native
`id` / `conversationId` redacted or hashed.

The logger is injectable through `ProviderContext`/runtime configuration. Where
[`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) §30 and
[`Architecture/Project-Context.md`](Architecture/Project-Context.md) §25A define specific redaction
requirements, follow those requirements; this file does not restate them as a competing policy.

## New data boundaries

If a feature introduces any of:

- new credential handling;
- new persistence;
- new personal-data processing;
- public-facing network surfaces;
- webhook verification;
- browser/provider boundaries;
- new diagnostic payload collection;

then the feature MUST identify that during SpecMan planning — in its `spec.md` and `plan.md` — and
follow the relevant security and adversarial review guidance in `AGENTS.md` and
[`Adoption/Integration-Guide.md`](Adoption/Integration-Guide.md) §6. Provider credentials, webhook
verification, public API contracts, cross-account boundaries, and provider-native identifiers are
the expected candidates for deeper review.

Tier 2 security tooling is human-triggered and is intentionally absent from the development
container; an agent may recommend it but cannot start it.
