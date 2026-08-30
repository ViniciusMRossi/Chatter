<!--
Sync Impact Report
- Version change: none (unpopulated template) → 1.0.0 (initial ratification)
- Bump rationale: initial ratification. The prior file was the unmodified Spec Kit scaffold with
  no project-specific values, so this is the first ratified Chatter constitution rather than an
  amendment of an existing one.
- Source: Docs/Adoption/Project-Constitution-Candidate.md, adopted without architectural
  redesign. Reviewed for conflict against Docs/Architecture/Core-Contract.md,
  Docs/Architecture/Project-Context.md, Docs/Architecture/Implementation-Roadmap.md,
  Docs/Architecture/Cross-Provider-Core-Mapping.md, Docs/Architecture/Decisions/, and
  Docs/Architecture/Review-History/. No conflict was found.
- Modified principles: none (no prior principles existed).
- Added sections:
    Core Principles I-XV (candidate sections 1-15)
    Authoritative Project Records (candidate section 16)
    Authority Model and Workflow Boundary (candidate section 18 plus the two-axis model)
    Governance (candidate section 17 plus amendment/versioning/compliance procedure)
- Removed sections: the five unpopulated scaffold placeholder principles.
- Follow-up TODOs: none deferred in this document. Adoption tasks that remain open outside it
  are tracked in Docs/Adoption/Adoption-Checklist.md.
-->

# Chatter Constitution

Chatter is messaging transport and provider-integration infrastructure for Node.js + TypeScript
applications. This constitution records the non-negotiable Chatter project rules. It is
deliberately concise: it governs, and it routes work to the authoritative architectural records
rather than duplicating them.

## Core Principles

### I. Product Boundary

Chatter owns provider integration; provider/account lifecycle; normalized messaging entities and
operations; capability discovery; provider-specific stable APIs where semantics are not common;
normalized errors; media retrieval as transport; framework-neutral webhook integration; and
reusable adapter behavior contracts.

Chatter does NOT own application business state, LLM behavior, prompts, RAG, long-term
conversation memory, CRM workflows, unread state, drafts, or an application conversation
database.

Rationale: Chatter is transport/integration infrastructure. Owning application state would make
the library responsible for business conversation truth it cannot reliably hold.

### II. Single Integration Surface, Not Single Capability Surface

1. Chatter provides a single integration surface, not a single capability surface.
2. Chatter abstracts platform integration, not meaningful platform differences.
3. Only semantics that are genuinely common MAY be normalized.
4. Provider-specific behavior MUST be preserved explicitly when semantics differ.
5. Unsupported semantics MUST NEVER silently degrade into different semantics.
6. Provider-specific structured content MUST use explicit structured extensions rather than
   ordinary consumer parsing of `raw` payloads.

Rationale: A false common denominator is worse than an honest provider-specific API, because it
silently changes application meaning.

### III. Strict Provider Order and Depth-First Delivery

Provider implementation order is strict:

1. WhatsApp
2. Slack
3. Telegram
4. Discord

Development is depth-first. The current provider's **adapter-complete Definition of Done** MUST
be finished before feature implementation begins for the next provider.

The ONLY cross-provider work permitted before the current provider is adapter-complete is the
**non-implementation architecture validation required by the Core Freeze Gate**, specifically
written/paper pressure tests and fake-provider profiles. That validation MUST NOT become partial
Slack, Telegram, or Discord feature or adapter implementation.

WhatsApp is the first reference adapter but MUST NOT define the Core model alone.

Rationale: Breadth-first provider work produces four half-adapters and a Core shaped by
convenience rather than by validated cross-provider semantics.

### IV. Core Isolation

- `@chatter/core` MUST NOT import provider SDKs.
- Provider SDK types MUST NOT leak into common Core contracts.
- Provider-specific behavior belongs in provider packages or in explicitly provider-specific
  extensions.
- Replacing a provider SDK MUST NOT force a breaking Chatter Core API change unless the Chatter
  contract itself changes.

### V. Identity and Semantic Fidelity

- Provider-native identifiers are the basis of Chatter identity.
- `MessageRef` includes conversation context because message identity is not globally unique
  across all target providers.
- `Conversation`, not `Channel`, is the common abstraction.
- Reply and thread are distinct concepts and MUST NOT be collapsed.
- Chatter MUST NOT fabricate provider-native identifiers, nor successful semantic states the
  provider did not supply.
- `isOwn` MUST be deterministic for normalized messages. Absent self identity is an explicit
  integration gap to resolve in the provider feature's human-approved `spec.md`; it is not
  permission to default to `false`.

### VI. No Implicit I/O (Rule N)

Inbound normalization is pure and synchronous.

An adapter MUST NOT perform provider/network I/O merely to enrich an inbound normalized object.
Metadata already present in an inbound provider payload MAY be preserved as a snapshot.
Enrichment that requires another provider request MUST be an explicit capability-gated
operation.

### VII. Capabilities and Authorization (Rule S)

Capability resolution is synchronous and pure.

A capability answers whether a provider model supports an operation in a given semantic context.
It does NOT guarantee that a specific provider attempt will be authorized or accepted at
runtime.

Permissions, policy, rate limits, account state, time-window rules, and other provider decisions
MUST surface through normalized runtime errors rather than by corrupting capability semantics.

The capability namespace remains extensible and typed.

### VIII. Lifecycle

- Lifecycle is per account, not globally transactional.
- Failure of one configured account MUST NOT roll back independent ready accounts.
- The canonical successful account state name is **`ready`**.
- During initial startup, an account that cannot reach `ready` transitions to `failed`;
  `reconnecting` is reserved for post-start recovery semantics.
- Do not introduce `degraded` until a concrete and provider-independent semantic exists.

### IX. Persistence and Provider Policy

Chatter does not maintain conversation history merely to predict provider policy.

In particular, WhatsApp's customer-service window is provider-authoritative. An expired window is
represented as a normalized `ProviderPolicyError`; Chatter does not maintain a shadow 24-hour
history state and does not silently switch the caller to a template send.

### X. Outbound Safety

- State-changing sends MUST NOT be retried automatically.
- Retry automation is limited to operations whose safety/idempotency contract makes retry valid.
- A timeout or ambiguous provider result MUST NOT be treated as proof that a state-changing send
  did not succeed.

### XI. Media and Browser Boundaries

- Common media support is retrieval/transport, not storage or re-hosting.
- Provider credentials MUST NOT be exposed to browser code.
- Provider-authenticated or temporary raw URLs MUST NOT become the common browser-facing media
  contract.

### XII. Example Client Boundary

The example client uses Chatter as an external consumer would.

- It MUST access provider behavior through Chatter rather than bypassing Chatter for
  convenience.
- Provider credentials and native SDK clients MUST NOT reach browser code.
- UI convenience MUST NOT introduce Chatter-owned conversation persistence or other application
  business state into the library.

### XIII. Errors and Observability

- Stable serialized error `code` values are cross-boundary contracts.
- Provider-specific codes use stable namespaces and SHOULD rely on structured provider error
  identifiers rather than message-text matching where available.
- Default logging MUST NOT include message content, access tokens, authorization headers, raw
  provider payloads, or canonical provider-native refs.
- Provider-native identifiers in refs may be personal data and MUST be redacted or hashed in
  default diagnostics.

### XIV. Contract-First Testing

Chatter uses the workflow layer's TDD mechanism with one additional project rule:

> When behavior is represented by a reusable Chatter adapter contract, the RED phase SHOULD begin
> with the corresponding failing contract test whenever practical.

A fake provider validates internal consistency, not provider truth. A reusable contract suite is
not externally validated until at least one real adapter passes it for the claimed behavior.

Fake-provider profiles MUST remain provider-shaped and include hostile scenarios rather than
teaching the Core an artificial superset provider.

### XV. Core Freeze Gate (NON-NEGOTIABLE)

Before **Phase 8: WhatsApp Driver Layer** begins, the Core MUST pass the frozen cross-provider
gate:

- approved cross-provider mapping;
- explicit paper pressure tests against at least Slack and Telegram semantics;
- fake-provider profiles exercising semantics WhatsApp does not cover;
- resolved contradictions;
- freeze Core public contracts after the cross-provider contradictions are resolved.

A **named human Core Architecture Approver** MUST review the gate evidence and explicitly approve
the freeze. The approval record MUST identify the human approver and be committed under
`Docs/Architecture/Review-History/` before Phase 8 begins.

Provider implementation MUST NOT bypass this gate.

## Authoritative Project Records

This constitution is intentionally concise. It does not duplicate the frozen interfaces and
detailed architecture.

An agent or human following the workflow instruction chain in `AGENTS.md` MUST use this
constitution to route Chatter work to the authoritative project records below:

1. `Docs/Architecture/Project-Context.md` — project-wide product boundaries, accepted decisions,
   Definition of Done rules, SDK intent, privacy/observability constraints, and deferred
   decisions;
2. `Docs/Architecture/Core-Contract.md` — the accepted Core public/SPI contract;
3. `Docs/Architecture/Implementation-Roadmap.md` — milestone ordering, phase gates, contract
   inventory, acceptance expectations, and final non-negotiables;
4. `Docs/Architecture/Cross-Provider-Core-Mapping.md` — cross-provider pressure-test evidence and
   Core assumptions;
5. `Docs/Architecture/Decisions/` — accepted decision records;
6. `Docs/Design/` — frozen design references when a feature affects the example client;
7. `Docs/Architecture/Review-History/` — recorded architecture/freeze approvals.

Before planning or implementing a Chatter feature, the agent MUST read
`Docs/Architecture/Core-Contract.md` and `Docs/Architecture/Project-Context.md`, plus any
roadmap, decision, mapping, or design records relevant to that feature. The active human-approved
feature `spec.md`, `plan.md`, and `tasks.md` refine these project-level constraints but do not
silently replace them.

`Docs/Tech-Stack.md` and `Docs/Privacy-Compliance.md` are owned by the workflow layer and MUST be
populated during adoption/Phase 0 with Chatter-specific content or explicit pointers to these
authoritative records. Empty scaffold templates are not sufficient project guidance.

## Authority Model and Workflow Boundary

The project uses two complementary authority axes. Neither axis silently overrides the other.

**Chatter project authority** governs what the project may build:

```text
this constitution
        ↓
frozen / accepted architecture records under Docs/Architecture/
        ↓
human-approved feature spec.md
        ↓
human-approved feature plan.md
        ↓
feature tasks.md
```

A lower artifact MUST NOT silently override a higher Chatter project rule.

**Workflow authority** governs how the project is developed. The pinned official Spec Kit and the
repository workflow layer described by `AGENTS.md` own the SDD artifact lifecycle, supported
commands, agent workflow, TDD evidence mechanics, Git/PR process, verification, handoff/dev-log,
and the development-container workflow. This constitution does not restate those mechanics and
MUST NOT be used to fork them.

If a workflow mechanism and a Chatter project rule genuinely conflict, stop and require a human
decision. Do not resolve the conflict by silently changing either the architecture or the
workflow behavior.

## Governance

This constitution is the normative source for Chatter project governance and for the Chatter side
of the two-axis authority model. README and integration documents may summarize that model but
MUST point back to this constitution rather than becoming parallel governance authorities.

**Architecture change governance.** Feature-level `spec.md`, `plan.md`, or `tasks.md` artifacts
MUST NOT silently override this constitution or a frozen architectural record. If a feature
genuinely conflicts with a constitutional or frozen rule:

1. stop implementation;
2. identify the conflict explicitly;
3. obtain a human architectural decision;
4. update the constitution and/or the affected architectural record;
5. only then continue feature planning or implementation.

Any feature that changes a frozen Core contract MUST update `Docs/Architecture/Core-Contract.md`
in the same change. The constitution, the feature artifacts, and the architectural records MUST
NOT be allowed to drift independently.

**Amendment procedure.** Amendments are made through the official Spec Kit constitution workflow
against this file, require explicit human approval, and MUST record the resulting version, the
rationale, and any dependent architectural record updated in the same change. An amendment that
weakens or removes a rule requires the same human architectural decision as a frozen-record
change. Amendments affecting the Core Freeze Gate additionally require the named human Core
Architecture Approver.

**Versioning policy.** Semantic versioning applies to this document:

- MAJOR — backward-incompatible governance changes: a principle is removed, redefined, or
  weakened;
- MINOR — a new principle or section is added, or existing guidance is materially expanded;
- PATCH — clarifications, wording, and non-semantic refinements.

**Compliance review.** Every feature review and PR MUST verify that the change respects this
constitution and the authoritative project records it names. Reviews of authentication, webhook,
credential, cross-account, or provider-identifier work are the expected candidates for
adversarial and deeper security review. Verification, TDD evidence, and review mechanics are
supplied by the workflow layer; the obligation to comply with this constitution is not.

**Version**: 1.0.0 | **Ratified**: 2026-08-30 | **Last Amended**: 2026-08-30
