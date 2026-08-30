# Chatter

> A Node.js + TypeScript messaging integration library that provides one integration surface without pretending every messaging platform is the same.

## Current status

**Core architecture: frozen and reviewed.**  
**Development workflow: SpecMan alignment P1-closure candidate.**  
**Implementation: not started in this package.**

This package is the SpecMan-aligned migration candidate for Chatter. It preserves the accepted Core architecture while removing the old project-local SDD workflow assumptions that would now duplicate or conflict with SpecMan.

---

## What Chatter is

Chatter aims to make applications integrate with messaging platforms through a stable common entry point while preserving meaningful provider differences.

Initial provider order is strict:

1. WhatsApp
2. Slack
3. Telegram
4. Discord

The central design rule is:

> **Chatter provides a single integration surface, not a single capability surface.**

And the related rule:

> **Chatter does not abstract away platform differences. It abstracts away platform integration.**

Chatter is transport/integration infrastructure. It does not own application business workflows, LLM behavior, prompts, RAG, long-term conversation memory, CRM state, or a conversation database.

---

## Why SpecMan changes the repository model

Earlier Chatter planning documents included their own Feature Planning → SDD → TDD workflow language. That was useful before SpecMan existed, but it would now create two competing workflow authorities.

The **human-approved Chatter constitution is the normative source** for the project side of the authority model. The summary below is explanatory only:

```text
SpecMan owns HOW the project is developed.
Chatter owns WHAT the project is and WHAT rules it must preserve.
```

### SpecMan owns

- Spec Kit lifecycle mechanics;
- generated agent instructions;
- container-first development surface;
- workflow checks;
- TDD evidence mechanics;
- Git/branch/PR conventions;
- human approval gates;
- baseline CI/security controls;
- handoff and dev-log mechanics.

### Chatter owns

- product boundaries;
- Core contract;
- public API architecture;
- provider semantics;
- capability model;
- adapter SPI constraints;
- testing contracts;
- cross-provider mapping;
- provider implementation order;
- roadmap and acceptance requirements;
- frozen design references.

---

## Canonical feature artifacts

Feature discovery may produce a **Feature Planning Brief**, but it is not the specification of record.

For meaningful work, the canonical feature artifacts are:

```text
spec.md   → behavioral/product truth after human approval
plan.md   → technical truth after human approval
tasks.md  → execution truth
```

GitHub Issues are tracking surfaces rather than duplicated specifications.

Chatter architecture documents remain higher-level project constraints and must be updated in the same change when a feature intentionally changes them.

---

## Roadmap phases are not automatically features

The Chatter roadmap is intentionally broader than a single SpecMan feature.

```text
Roadmap Phase
    │
    ├── SpecMan Feature A
    ├── SpecMan Feature B
    └── SpecMan Feature C
```

Features should be independently verifiable. By default, one meaningful feature should map to one feature branch and one PR under the SpecMan workflow.

---

## Architecture highlights

The frozen Core architecture includes, among other decisions:

- provider SDK isolation from `@chatter/core`;
- provider-native identifiers;
- `Conversation` as the common abstraction rather than `Channel`;
- `MessageRef` carrying conversation context;
- reply and thread as separate semantics;
- pure synchronous capability resolution;
- capability support separated from provider authorization;
- no implicit provider I/O during inbound normalization;
- no hidden Chatter conversation persistence;
- per-account lifecycle instead of global startup rollback;
- stable serialized error codes;
- common media retrieval without credential leakage to browsers;
- provider-shaped fake profiles for contract testing;
- a mandatory cross-provider Core freeze gate before WhatsApp Driver implementation.

---

## Contract-first TDD

Chatter uses SpecMan's RED → GREEN → refactor workflow, with one project-specific refinement:

> When behavior belongs to a reusable Chatter adapter contract, the RED phase should begin with the corresponding failing contract test whenever practical.

A fake provider proves internal consistency, not provider truth. A reusable contract becomes externally validated only when real provider implementation evidence supports it.

---

## Core Freeze Gate

The Core freeze remains a hard architectural gate before **Roadmap Phase 8: WhatsApp Driver Layer**.

Before crossing the gate, Chatter requires:

- approved cross-provider mapping;
- explicit paper pressure tests against at least Slack and Telegram semantics;
- fake-provider profiles exercising semantics WhatsApp does not cover;
- resolved architectural contradictions;
- freeze Core public contracts after the cross-provider contradictions are resolved.

A named human Core Architecture Approver must explicitly approve the gate, with the approver identity and approval record committed under `Docs/Architecture/Review-History/` before Phase 8 begins.

---

## Repository documents

### Architecture

- [`Docs/Architecture/Project-Context.md`](Docs/Architecture/Project-Context.md)  
  Full project-level product/architecture context and frozen constraints.

- [`Docs/Architecture/Core-Contract.md`](Docs/Architecture/Core-Contract.md)  
  Concise record of accepted Core contract decisions.

- [`Docs/Architecture/Implementation-Roadmap.md`](Docs/Architecture/Implementation-Roadmap.md)  
  Ordered implementation milestones. This is a product roadmap, not a replacement for SpecMan feature plans.

- [`Docs/Architecture/Cross-Provider-Core-Mapping.md`](Docs/Architecture/Cross-Provider-Core-Mapping.md)  
  Cross-provider pressure-test mapping that protects Core from WhatsApp-only assumptions.

- [`Docs/Architecture/Decisions/WhatsApp-Customer-Service-Window.md`](Docs/Architecture/Decisions/WhatsApp-Customer-Service-Window.md)  
  Accepted decision not to maintain a Chatter-owned shadow of WhatsApp's customer-service window.

- [`Docs/Architecture/Example-Client-Implementation-Notes.md`](Docs/Architecture/Example-Client-Implementation-Notes.md)  
  Notes reconciling the frozen example-client design with Core decisions.

### Adoption / SpecMan integration

- [`Docs/Architecture/Review-History/Project-Constitution-Candidate-v1.0.md`](Docs/Architecture/Review-History/Project-Constitution-Candidate-v1.0.md)  
  Retired constitution candidate, kept for provenance only. The canonical constitution is
  [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

- [`Docs/Adoption/Integration-Guide.md`](Docs/Adoption/Integration-Guide.md)  
  Defines the ownership boundary between Chatter and SpecMan.

- [`Docs/Adoption/Adoption-Checklist.md`](Docs/Adoption/Adoption-Checklist.md)  
  Practical checklist for turning this reviewed package into the implementation repository.

### Design

- [`Docs/Design/Chatter-Client-Design-Spec-v1.2.1-Frozen.zip`](Docs/Design/Chatter-Client-Design-Spec-v1.2.1-Frozen.zip)  
  Frozen example-client design reference.

### Review history

- [`Docs/Architecture/Review-History/Core-Freeze-Final-Review-Closure.md`](Docs/Architecture/Review-History/Core-Freeze-Final-Review-Closure.md)

---

## What is intentionally NOT in this package

This package does **not** hand-write copies of files that SpecMan should generate, including the final forms of:

```text
AGENTS.md
CLAUDE.md
.devcontainer/
.github/ SpecMan baseline workflow
.sdd/
.specify/
SpecMan workflow helper scripts
handoff/dev-log infrastructure
```

That omission is deliberate. Those files should be created by the pinned SpecMan release so Chatter does not immediately fork the workflow it is trying to consume.

---

## Recommended adoption flow

**Adoption status:** steps 1–8 below are complete. Chatter Constitution v1.0.0 is ratified at
[`.specify/memory/constitution.md`](.specify/memory/constitution.md), and the constitution candidate
named in step 5 has been retired to
[`Docs/Architecture/Review-History/Project-Constitution-Candidate-v1.0.md`](Docs/Architecture/Review-History/Project-Constitution-Candidate-v1.0.md)
as provenance only. Roadmap Phase 0 (step 9) has not started and remains behind a human gate. The
sequence below is kept as the original recommended flow for this migration package.

After this migration package is reviewed and accepted:

```text
1. Create the private Chatter implementation repository.
2. Commit the reviewed Chatter project documents.
3. Run the pinned SpecMan release against the repository.
4. Validate the generated SpecMan environment/workflow.
5. Use the constitution candidate as input to the SpecMan constitution lifecycle.
6. Human-review and approve the resulting constitution.
7. Starting only from generated AGENTS.md, verify that its reading chain reaches the constitution and then the Chatter Core Contract / Project Context.
8. Populate generated Docs/Tech-Stack.md and Docs/Privacy-Compliance.md with Chatter-specific guidance and authoritative pointers.
9. Begin Roadmap Phase 0 as one or more SpecMan features.
10. Configure the generated .sdd/commands.env with real Chatter commands.
11. Continue the roadmap feature-by-feature.
```

See [`Docs/Adoption/Integration-Guide.md`](Docs/Adoption/Integration-Guide.md) for the full model.

---

## Review status of this migration package

This package intentionally changes **workflow/governance wording and repository organization**, not the frozen Chatter product architecture.

The review package includes the original frozen source, diffs, prior review, and validation material under `review-only/`. **`review-only/` is not live repository content and must not be committed when this migration is adopted.** Accepted review history already stored under `Docs/Architecture/Review-History/` remains repository content.

The migration should be rejected if it accidentally:

- changes a frozen public/Core semantic decision without explicitly identifying it;
- makes SpecMan subordinate to duplicated Chatter workflow mechanics;
- makes SpecMan workflow behavior override the Chatter constitution;
- treats the Feature Planning Brief as canonical;
- treats a roadmap phase as automatically one SpecMan feature;
- reintroduces old Spec Kit command spellings into architecture docs;
- makes Docker/dev-container use optional at the workflow level because of the domain term "container";
- creates a second agent-instruction source of truth.

See `review-only/DELTA-REVIEW-BRIEF.md` for the current external-review brief.
