# Chatter + SpecMan Integration Guide

## Purpose

This document defines how the frozen Chatter architecture should be consumed by SpecMan without duplicating SpecMan's workflow inside the Chatter repository.

It is a migration/integration guide, not a substitute for generated `AGENTS.md`, Spec Kit artifacts, or the human-approved Chatter constitution.

---

## 1. Ownership Model

### SpecMan owns workflow mechanics

SpecMan is responsible for the reusable development surface:

- Spec Kit lifecycle;
- generated `AGENTS.md` as the agent-instruction source of truth;
- native-agent pointer/import files such as `CLAUDE.md`;
- container-first development surface;
- `.sdd/` workflow configuration;
- workflow conformance checks;
- TDD RED/GREEN/refactor evidence mechanics;
- base Git/branch/PR conventions;
- human approval gates;
- baseline Tier 1 security checks;
- Tier 2 recommendation policy;
- handoff and dev-log mechanics.

Chatter documentation MUST NOT clone these mechanisms or pin internal Spec Kit command spellings.

### Chatter owns project truth

Chatter remains authoritative for:

- product boundaries;
- public API architecture;
- provider semantics;
- Core contract;
- adapter SPI constraints;
- capability semantics;
- testing contracts;
- cross-provider mapping;
- provider implementation order;
- roadmap/milestones;
- acceptance expectations;
- frozen design references.

---

## 2. Two-Axis Authority

The human-approved Chatter constitution is the **normative source** for this authority model. This guide explains how to operationalize it and must defer to the constitution if wording ever drifts.

There are two related but different authority axes.

### Project-content authority

```text
Human-approved Chatter constitution
        ↓
Frozen / accepted architecture records
        ↓
Human-approved feature spec.md
        ↓
Feature plan.md
        ↓
Feature tasks.md
```

A lower artifact cannot silently override a higher Chatter project rule.

### Workflow-mechanism authority

Use the repository's SpecMan-generated `AGENTS.md` and pinned SpecMan/Spec Kit behavior for workflow mechanics.

Do not encode current Spec Kit command names in Chatter architecture documents. If Spec Kit changes its command surface in a future SpecMan release, Chatter architecture should not need an edit merely because workflow syntax changed.

### Conflict handling

If a workflow mechanism appears incompatible with a Chatter project rule, stop and request human resolution. Do not resolve the conflict by silently changing either architecture or workflow behavior.

---

## 3. Canonical Feature Artifacts

A Feature Planning Brief may be produced during discovery. It is temporary planning input and is **not** the canonical feature specification.

For a meaningful feature:

- `spec.md` is behavioral/product truth after human approval;
- `plan.md` is technical implementation truth after human approval;
- `tasks.md` is execution truth;
- GitHub Issues are tracking surfaces, not duplicate specifications.

Architecture records in `Docs/Architecture/` remain project-level constraints and must be updated in the same change when a feature intentionally changes them.

---

## 4. Roadmap Phase vs SpecMan Feature

The Chatter Implementation Roadmap is intentionally coarser than the SpecMan feature lifecycle.

```text
Roadmap Phase
    │
    ├── SpecMan Feature A
    ├── SpecMan Feature B
    └── SpecMan Feature C
```

A phase may map to one feature when genuinely small, but that is not the default assumption.

Prefer independently verifiable features. By default:

```text
one meaningful feature
=
one feature branch
=
one PR
```

Example for Roadmap Phase 1:

- Core entity references;
- common snapshots/content model;
- capability registry;
- public operation/handle model;
- error contract;
- adapter SPI;
- common event-name contract.

The exact split is decided during Feature Planning / specification based on cohesion and independent verifiability, not fixed by this guide.

---

## 5. Phase 0 with SpecMan

Phase 0 is no longer responsible for inventing general development infrastructure.

### SpecMan-generated or SpecMan-owned

Expect SpecMan to supply/manage the base forms of:

```text
AGENTS.md
CLAUDE.md or equivalent native pointer
.devcontainer/
.github/
.sdd/
.specify/
scripts/ workflow helpers
handoff/dev-log mechanics
baseline CI/security workflow
```

The exact generated tree is owned by the pinned SpecMan release, not by this document.

### Chatter-owned Phase 0 work

Create and configure:

```text
packages/core
packages/testing
packages/whatsapp
packages/slack
packages/telegram
packages/discord

apps/validation-server
apps/example-client

bruno
Docs
```

Decide the package manager, workspace setup, TypeScript baseline, build/lint/typecheck/test commands, package versioning, Node requirements, and package dependency boundaries.

Once the real commands exist, configure the SpecMan-generated `.sdd/commands.env` so SpecMan verification executes the Chatter monorepo's actual checks.

---

## 6. CI and Security Extension Model

Do not build a parallel Chatter CI framework that competes with SpecMan.

SpecMan supplies the baseline workflow and Tier 1 security mechanics. Chatter extends that baseline with product-specific jobs such as:

- reusable contract suites;
- fake-provider profile tests;
- Bruno credential-free acceptance;
- validation-server integration tests;
- provider-specific tests;
- protected live-provider jobs where justified;
- example-client E2E where justified.

Provider credentials, webhook verification, public API contracts, cross-account boundaries, and provider-native identifiers are high-value candidates for adversarial review and/or deeper security review. Chatter identifies the risk; SpecMan supplies the review mechanism and policy.

---

## 7. TDD Specialization

SpecMan defines RED → GREEN → refactor and the evidence mechanics.

Chatter defines which tests best express its contracts.

For common adapter behavior:

```text
approved behavior
    ↓
RED: reusable Chatter contract test fails
    ↓
GREEN: implementation satisfies contract
    ↓
refactor
    ↓
provider/integration acceptance as required
```

Do not substitute fake-provider success for real-provider semantic validation.

---

## 8. Core Freeze as an Explicit Gate

The frozen Core gate remains before Roadmap Phase 8.

Treat the gate as an explicit SpecMan-tracked validation milestone rather than a vague prose checkpoint. It should gather evidence from:

- Core Contract;
- Cross-Provider Core Mapping;
- paper pressure tests;
- fake-provider profiles;
- open contradiction resolution;
- freeze Core public contracts after the evidence is reviewed and contradictions are resolved.

A named human Core Architecture Approver must explicitly approve the evidence. Record that person's identity and the approval under `Docs/Architecture/Review-History/` before Phase 8 begins.

Only after this gate is satisfied should the WhatsApp Driver Layer proceed.

---

## 9. Generated Agent Instructions

`AGENTS.md` is generated/managed through SpecMan and is the single source of truth for agent workflow instructions.

Do not create a second Chatter-specific agent rulebook. Instead, point agents from the SpecMan instruction surface to the Chatter project sources that matter:

1. human-approved constitution, whose Authoritative Project Records section is the required bridge into Chatter architecture;
2. `Docs/Architecture/Project-Context.md`;
3. `Docs/Architecture/Core-Contract.md`;
4. `Docs/Architecture/Implementation-Roadmap.md`;
5. relevant decision records and design references;
6. current feature `spec.md`, `plan.md`, and `tasks.md`.

Native instruction files such as `CLAUDE.md` should remain pointers/imports to `AGENTS.md` according to SpecMan's generated convention rather than duplicating Chatter rules.

---

## 10. Adoption Sequence

Recommended sequence for turning this package into the implementation repository:

```text
1. Create the private Chatter repository from this package.
2. Run the pinned SpecMan release against the repository.
3. Run SpecMan environment/workflow checks.
4. Use the project constitution candidate as input to the SpecMan constitution step. (Completed for
   Chatter Constitution v1.0.0; the candidate is now retired to
   `Docs/Architecture/Review-History/Project-Constitution-Candidate-v1.0.md` for provenance only and
   is not an authority.)
5. Human-review and approve the resulting constitution.
6. Starting only from generated `AGENTS.md`, verify that the instruction chain reaches the constitution and then the Core Contract / Project Context.
7. Populate SpecMan-generated `Docs/Tech-Stack.md` and `Docs/Privacy-Compliance.md` with Chatter-specific guidance/pointers.
8. Start Roadmap Phase 0 as one or more SpecMan features.
9. Define actual monorepo verification commands.
10. Configure .sdd/commands.env.
11. Verify through the SpecMan verification surface.
12. Continue roadmap phases as independently verifiable SpecMan features.
```

This package intentionally does not include hand-written copies of SpecMan-generated infrastructure. That omission is a design choice intended to prevent workflow drift.
