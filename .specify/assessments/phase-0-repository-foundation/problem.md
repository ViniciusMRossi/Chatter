# Problem Definition: Phase 0 — Chatter Repository Foundation

- **Slug**: phase-0-repository-foundation
- **Created**: 2026-08-30
- **Inputs used**: intake.md, research.md

## Problem Statement

Chatter has a ratified constitution, a frozen Core contract and a sequenced roadmap, but no
buildable repository: there is no workspace, no package manifest, no TypeScript configuration, no
test runner, and no JavaScript runtime in the canonical development container. Until that
foundation exists, no Chatter feature can be implemented, verified through
`scripts/verify.sh`, or merged under the project's own PR requirements.

## Affected Users & Stakeholders

- **Users**: implementing agents (and the maintainer acting as one) — cannot start Phase 1, cannot
  produce TDD RED evidence, and cannot satisfy the PR template's verification checkbox, because
  `scripts/verify.sh` exits 2 with no commands configured.
- **Users**: reviewers — have no mechanical way to confirm that a change respects the frozen
  dependency boundaries (Core ↛ provider SDKs, provider ↛ provider, production ↛ `@chatter/testing`);
  today those rules are prose only.
- **Stakeholders**: the human maintainer / repository owner — decides the stack, owns the
  substitution procedure in `Docs/Tech-Stack.md`, and holds the licensing and code-ownership
  decisions.
- **Stakeholders**: future external consumers of `@chatter/*` — inherit the module format,
  engine range and versioning consequences of choices made here, and cannot influence them later
  without a breaking change.

## Goals

- A monorepo that builds, typechecks, lints and tests from a cold clone, entirely inside the
  canonical development container.
- The frozen package/app layout materialised, with every package boundary declared and — where
  practical — mechanically enforced rather than merely documented.
- `.sdd/commands.env` populated so `scripts/verify.sh` and the existing `quality.yml` CI job both
  pass without inventing a parallel CI toolchain.
- A language/runtime baseline that provably satisfies the frozen requirements (`Error.cause`,
  `ReadableStream<Uint8Array>`) and supports independently versioned packages.
- Every consequential stack choice explicitly recorded in `Docs/Tech-Stack.md` with its rationale,
  so later substitution follows the approved procedure instead of drifting silently.
- Phase 1 can begin with no remaining infrastructure questions.

## Non-Goals

- Any Chatter Core behaviour: entity refs, snapshots, content model, capability registry, handles,
  errors, or the Adapter SPI. These are Phase 1.
- Any provider behaviour, adapter, or SDK integration — including WhatsApp. Provider order and
  depth-first delivery remain frozen.
- Fake-provider semantics beyond, at most, an empty package skeleton; profiles are Phase 2.
- Example-client functionality beyond the minimum needed to exist as a workspace member.
- Bruno collections or API tests — the first collection is a Phase 7 deliverable.
- Release automation, publishing, or a registry release.
- Any change to Chatter's frozen architecture, the constitution, or SpecMan workflow mechanics.
- Redesigning the development container or replacing it with a Chatter-specific environment.

## Success Metrics

- `bash scripts/dev.sh verify` exits 0 from a clean checkout inside the container
  (baseline: exits 2 — "No verification commands configured").
- Node, the chosen package manager and TypeScript are all present in the container image
  (baseline: all absent).
- Each of the six `.sdd/commands.env` variables is either populated or has a recorded reason to
  stay empty (baseline: all six empty).
- Every frozen boundary rule has an automated check that fails on violation — measured as: a
  deliberately introduced cross-provider import, or a `@chatter/testing` production dependency,
  is rejected by lint/test/build rather than merging (baseline: no check exists).
- `packages/*` and `apps/*` all build to declarations + source maps via one root command
  (baseline: nothing builds).
- The `quality.yml` PR job passes on a real PR (baseline: never exercised against project code).
- Qualitative: a new agent can go from clone to green verification using only `AGENTS.md` and
  `Docs/Tech-Stack.md`, with no undocumented steps.

## Cost of Inaction

Phase 1 cannot start. Every downstream phase inherits the block, because the roadmap makes the
Core public model and Adapter SPI depend on a buildable workspace, and the Core Freeze Gate before
Phase 8 depends on contract suites that need a test runner to exist. The project's own governance
also degrades: PRs cannot honestly tick the verification checkbox, TDD RED evidence cannot be
produced by running a real failing test, and the frozen boundary rules stay unenforceable prose —
so the first architectural violation would be caught by human review or not at all.

## Open Questions

- [NEEDS CLARIFICATION: package manager choice — the decisive criterion is whether strict
  dependency isolation is wanted as boundary enforcement, at the cost of symlink behaviour on a
  Windows bind mount.]
- [NEEDS CLARIFICATION: module publishing model — ESM-only is now viable on a Node ≥24 baseline;
  dual publishing is the conservative alternative at roughly double the maintenance cost.]
- [NEEDS CLARIFICATION: TypeScript line — TS 6 keeps `typescript-eslint` type-aware linting
  working; TS 7 is much faster but has no stable programmatic API until 7.1.]
- [NEEDS CLARIFICATION: npm scope ownership for `@chatter/*`.]
- [NEEDS CLARIFICATION: LICENSE — required before the first implementation commit per the
  Adoption Checklist; a human/business decision.]
- [NEEDS CLARIFICATION: CODEOWNERS identity, and whether "require at least one human approval" is
  workable while there is a single maintainer.]
- [NEEDS CLARIFICATION: who fixes the `.specify/` root-ownership defect that prevents container-side
  Spec Kit writes — it is a SpecMan bootstrap concern, not a Chatter architecture concern.]
