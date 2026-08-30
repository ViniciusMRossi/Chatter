# Chatter: Project Constitution Candidate

> **Historical status notice — added 2026-08-30 during SpecMan adoption.**
>
> This document was the source candidate used to ratify **Chatter Constitution v1.0.0**.
> It is retained here for **provenance only** and is **no longer authoritative**.
> The canonical project constitution is
> [`.specify/memory/constitution.md`](../../../.specify/memory/constitution.md).
>
> Its path before archival was `Docs/Adoption/Project-Constitution-Candidate.md`.
> Everything below this notice is preserved unchanged as it stood at ratification, including
> the original status wording, which describes the candidate's role before adoption.

## Status

**Candidate for installation through the SpecMan / Spec Kit constitution lifecycle.**

This file captures Chatter-specific non-negotiable project rules extracted from the frozen architecture. It is intentionally stored as a project document instead of being placed directly in `.specify/memory/constitution.md` before SpecMan initializes the repository.

The human-approved constitution created through SpecMan becomes the authoritative constitutional record. This candidate should be used as its starting input, not maintained as a second competing constitution after adoption.

Once adopted, the human-approved constitution is the **normative source for Chatter project governance and the two-axis authority model**. README and integration documents may summarize that model, but must point back to the constitution rather than becoming parallel governance authorities.

---

## 1. Product Boundary

Chatter is messaging transport and provider-integration infrastructure for Node.js + TypeScript applications.

Chatter owns:

- provider integration;
- provider/account lifecycle;
- normalized messaging entities and operations;
- capability discovery;
- provider-specific stable APIs where semantics are not common;
- normalized errors;
- media retrieval as transport;
- framework-neutral webhook integration;
- reusable adapter behavior contracts.

Chatter does **not** own application business state, LLM behavior, prompts, RAG, long-term conversation memory, CRM workflows, unread state, drafts, or an application conversation database.

---

## 2. Integration Philosophy

1. **Single integration surface, not single capability surface.**
2. **Abstract integration, not platform differences.**
3. Normalize only semantics that are genuinely common.
4. Preserve provider-specific behavior explicitly when semantics differ.
5. Unsupported semantics must never silently degrade into different semantics.
6. Provider-specific structured content must use explicit structured extensions rather than ordinary consumer parsing of `raw` payloads.

---

## 3. Provider Strategy

Provider implementation order is strict:

1. WhatsApp
2. Slack
3. Telegram
4. Discord

Development is depth-first. Finish the current provider's **adapter-complete Definition of Done** before beginning feature implementation for the next provider.

The only cross-provider work allowed before the current provider is adapter-complete is the **non-implementation architecture validation required by the Core Freeze Gate**, specifically written/paper pressure tests and fake-provider profiles. This work is architecture validation and MUST NOT become partial Slack, Telegram, or Discord feature/adapter implementation.

WhatsApp is the first reference adapter but must not define the Core model alone.

---

## 4. Core Isolation

- `@chatter/core` MUST NOT import provider SDKs.
- Provider SDK types MUST NOT leak into common Core contracts.
- Provider-specific behavior belongs in provider packages or explicitly provider-specific extensions.
- Provider SDK replacement should not force a breaking Chatter Core API change unless the Chatter contract itself changes.

---

## 5. Identity and Semantic Fidelity

- Provider-native identifiers are the basis of Chatter identity.
- `MessageRef` includes conversation context because message identity is not globally unique across all target providers.
- `Conversation`, not `Channel`, is the common abstraction.
- Reply and thread are distinct concepts and MUST NOT be collapsed.
- Chatter MUST NOT fabricate provider-native identifiers or successful semantic states that the provider did not supply.
- `isOwn` must be deterministic for normalized messages; lack of self identity is an explicit integration gap, not permission to default to `false`.

---

## 6. No Implicit I/O

Inbound normalization is pure and synchronous.

An adapter MUST NOT perform provider/network I/O merely to enrich an inbound normalized object. Metadata already present in an inbound provider payload may be preserved as a snapshot. Enrichment requiring another provider request must be an explicit capability-gated operation.

---

## 7. Capabilities and Authorization

Capability resolution is synchronous and pure.

A capability answers whether a provider model supports an operation in a given semantic context. It does **not** guarantee that a specific provider attempt will be authorized or accepted at runtime.

Permissions, policy, rate limits, account state, time-window rules, and other provider decisions surface through normalized runtime errors rather than by corrupting capability semantics.

The capability namespace remains extensible and typed.

---

## 8. Lifecycle

- Lifecycle is per account, not globally transactional.
- Failure of one configured account does not roll back independent ready accounts.
- The canonical ready state name is **`ready`**.
- During initial startup, an account that cannot reach `ready` transitions to `failed`; `reconnecting` is reserved for post-start recovery semantics.
- Do not introduce `degraded` until a concrete and provider-independent semantic exists.

---

## 9. Persistence and Provider Policy

Chatter does not maintain conversation history merely to predict provider policy.

In particular, WhatsApp's customer-service window is provider-authoritative. An expired window is represented as a normalized `ProviderPolicyError`; Chatter does not maintain a shadow 24-hour history state and does not silently switch the caller to a template send.

---

## 10. Outbound Safety

- State-changing sends MUST NOT be retried automatically.
- Retry automation is limited to operations whose safety/idempotency contract makes retry valid.
- A timeout or ambiguous provider result MUST NOT be treated as proof that a state-changing send did not succeed.

---

## 11. Media and Browser Boundaries

- Common media support is retrieval/transport, not storage or re-hosting.
- Provider credentials MUST NOT be exposed to browser code.
- Provider-authenticated or temporary raw URLs MUST NOT become the common browser-facing media contract.

---

## 12. Example Client Boundary

The example client uses Chatter as an external consumer would.

- It MUST access provider behavior through Chatter rather than bypassing Chatter for convenience.
- Provider credentials and native SDK clients MUST NOT reach browser code.
- UI convenience MUST NOT introduce Chatter-owned conversation persistence or other application business state into the library.

---

## 13. Errors and Observability

- Stable serialized error `code` values are cross-boundary contracts.
- Provider-specific codes use stable namespaces and should rely on structured provider error identifiers rather than message-text matching where available.
- Default logging MUST NOT include message content, access tokens, authorization headers, raw provider payloads, or canonical provider-native refs.
- Provider-native identifiers in refs may be personal data and must be redacted or hashed in default diagnostics.

---

## 14. Contract-First Testing

Chatter uses SpecMan's TDD mechanism with an additional project rule:

> When behavior is represented by a reusable Chatter adapter contract, the RED phase should begin with the corresponding failing contract test whenever practical.

A fake provider validates internal consistency, not provider truth. A reusable contract suite is not externally validated until at least one real adapter passes it for the claimed behavior.

Fake-provider profiles must remain provider-shaped and include hostile scenarios rather than teaching the Core an artificial superset provider.

---

## 15. Core Freeze Gate

Before **Phase 8: WhatsApp Driver Layer** begins, the Core must pass the frozen cross-provider gate:

- approved cross-provider mapping;
- explicit paper pressure tests against at least Slack and Telegram semantics;
- fake-provider profiles exercising semantics WhatsApp does not cover;
- resolved contradictions;
- freeze Core public contracts after the cross-provider contradictions are resolved.

A **named human Core Architecture Approver** must review the gate evidence and explicitly approve the freeze. The approval record MUST identify the human approver and be committed under `Docs/Architecture/Review-History/` before Phase 8 begins.

Provider implementation must not bypass this gate.

---

## 16. Authoritative Project Records

This constitution is intentionally concise. It does not duplicate the frozen interfaces and detailed architecture.

An agent or human following the SpecMan instruction chain MUST use this constitution to route Chatter work to the authoritative project records below:

1. `Docs/Architecture/Project-Context.md` for project-wide product boundaries, accepted decisions, Definition of Done rules, SDK intent, privacy/observability constraints, and deferred decisions;
2. `Docs/Architecture/Core-Contract.md` for the accepted Core public/SPI contract;
3. `Docs/Architecture/Implementation-Roadmap.md` for milestone ordering, phase gates, contract inventory, acceptance expectations, and final non-negotiables;
4. `Docs/Architecture/Cross-Provider-Core-Mapping.md` for cross-provider pressure-test evidence and Core assumptions;
5. `Docs/Architecture/Decisions/` for accepted decision records;
6. `Docs/Design/` for frozen design references when a feature affects the example client;
7. `Docs/Architecture/Review-History/` for recorded architecture/freeze approvals.

Before planning or implementing a Chatter feature, the agent MUST read the Core Contract and Project Context plus any roadmap, decision, mapping, or design records relevant to that feature. The active human-approved feature `spec.md`, `plan.md`, and `tasks.md` refine these project-level constraints but do not silently replace them.

The SpecMan-owned `Docs/Tech-Stack.md` and `Docs/Privacy-Compliance.md` MUST be populated during adoption/Phase 0 with Chatter-specific content or explicit pointers to these authoritative records. Empty scaffold templates are not sufficient project guidance.

---

## 17. Architecture Change Governance

Feature-level `spec.md`, `plan.md`, or `tasks.md` artifacts MUST NOT silently override this constitution or frozen architectural records.

If a feature genuinely conflicts with a constitutional or frozen rule:

1. stop implementation;
2. identify the conflict explicitly;
3. obtain a human architectural decision;
4. update the constitution and/or affected architectural record;
5. only then continue feature planning or implementation.

Any feature that changes a frozen Core contract must update the Core Contract record in the same change.

---

## 18. Workflow Boundary

This constitution governs **Chatter project rules** and is the normative source for the Chatter side of the two-axis authority model.

SpecMan and its pinned Spec Kit integration govern **workflow mechanics**, including generated agent instructions, artifact lifecycle, container-first execution, workflow checks, TDD evidence mechanics, Git/PR conventions, baseline CI/security controls, and handoff/dev-log behavior.

Neither axis silently overrides the other. A real conflict requires human resolution.
