# Decision: Phase 0 — Chatter Repository Foundation

- **Slug**: phase-0-repository-foundation
- **Decided**: 2026-08-31
- **Verdict**: go
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md, feature-planning-brief.md (incl. §16 human ratification)
- **Supersedes**: the `needs-clarification` verdict recorded 2026-08-30 (preserved below)

## Decision history

```text
initial assessment (2026-08-30)
        ↓
needs-clarification (2026-08-30)
        ↓
human decisions ratified (2026-08-31, feature-planning-brief.md §16)
        ↓
GO for Phase 0 execution (2026-08-31)
```

The earlier verdict was **not** doubt about the milestone. It was an explicit refusal to over-claim
a `go` while eleven §14 decisions were unratified recommendations and two operational items lacked
an owner. That gap has now closed by human ratification, not by re-scoring the evidence. No new
research was performed and none was required; the 2026-08-30 evidence base stands unchanged.

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | Unchanged: `scripts/verify.sh` exits 2 with no commands configured, the container has no JavaScript runtime, and the roadmap makes Phase 0 the precondition for Phase 1. Observable, not argued. |
| Evidence strength | strong | Unchanged: constraints read directly from the frozen records; container state verified by execution; Node LTS status, the TypeScript 7 programmatic-API gap, and `require(esm)` status verified against primary sources on 2026-08-30. |
| Value vs. inaction | strong | Unchanged: inaction blocks every downstream phase, prevents honest TDD RED evidence, and leaves three constitutional boundary rules mechanically unenforceable. |
| Feasibility / appetite | adequate | Improved but not perfect. A medium appetite remains credible, and R1 is now resolved. R2 — strict symlinked installs on the Windows bind mount — is still unexercised; it is an implementation-time unknown with two recorded fallbacks, not a specification blocker. |
| Strategic fit | strong | Unchanged: mandated by `Docs/Architecture/Implementation-Roadmap.md` §2 and the Adoption Checklist Phase 0 block. The ratified direction honours the roadmap's least-complexity preference — no orchestrator, no release automation, no bundler. |
| Risk posture | strong | Upgraded from `adequate`. R1 (the `.specify/` container-ownership defect) was the realised, unowned risk behind that rating; it is fixed upstream in SpecMan v0.1.1, surgically repaired here, and re-verified in-container on 2026-08-31 (`uid=1000(vscode)`, write under `.specify/` succeeds). The remaining risks are identified with concrete, recorded mitigations. |

## Verdict & Rationale

**go.**

Every criterion bearing on worth was already `strong` on 2026-08-30, and the only thing standing
between this assessment and a handoff was human ratification of the technical direction. That
ratification is now recorded in `feature-planning-brief.md` §16: package manager, runtime baseline,
language line, module format, build tooling, boundary-enforcement strategy, orchestrator, release
automation, licence, code ownership, container extension, and feature decomposition are all decided
by the decision-maker rather than assumed by an agent. Freezing a `spec.md` over these choices is
therefore no longer the drift the constitution's architecture-change governance exists to prevent.

Two items that contributed to the earlier verdict are resolved by other means rather than by
ratification. R1 is closed externally and empirically. The npm `@chatter` scope question is resolved
in a narrower form than originally posed: `@chatter/*` is ratified as the **project/package naming
convention**, while ownership of the registry scope is explicitly **not claimed** and is recorded as
a pre-publication requirement. This is sufficient because the first feature publishes nothing, adds
no release automation, and creates no registry artifact — nothing in the frozen architecture or the
Spec Kit mechanism requires publication rights to be proven before a non-publishing repository
foundation may be specified. Should publication ever be attempted without that evidence, it is a
blocker at that point, not at this one.

Feasibility remains `adequate` deliberately. R2 has still not been executed, and a `go` should not
launder an untested operational assumption into confidence. It is correctly located: an
implementation-time risk carried into the feature, with a flat-linker fallback and a container-side
volume fallback already recorded, either of which would be handled through the `Docs/Tech-Stack.md`
substitution procedure.

## Resolved clarifications (previously blocking)

Every question listed under the 2026-08-30 verdict, and its disposition. Nothing is discarded.

| Previously blocking question | Disposition |
|---|---|
| D1 package manager — pnpm, npm workspaces, or Yarn? | **Resolved**: pnpm. |
| D2 Node baseline — approve `>=24.0.0` on the Active LTS line? | **Resolved**: Node `>=24`, with an exact 24.x pin to be selected during planning for reproducible execution surfaces. |
| D3 TypeScript — TS 6 now with a tracked TS 7 migration? | **Resolved**: TypeScript 6, configured so a TS 7 migration stays reasonably mechanical. TS 7 not adopted in F1. |
| D4 module format — ESM-only or dual ESM/CJS? | **Resolved**: ESM-only, with entry graphs kept synchronously loadable and free of top-level await where that would needlessly break `require(esm)`. |
| D6 lint/format — ESLint + typescript-eslint + Prettier, or Biome? | **Resolved**: ESLint + typescript-eslint (type-aware) + Prettier. Scheduled into **F2**. |
| D7 test runner — Vitest or the built-in runner? | **Resolved**: Vitest. Scheduled into **F2**. |
| D8 is the `@chatter` npm scope owned or obtainable? | **Partially resolved**: ratified as a naming convention. Registry ownership is **not evidenced and not claimed**; verification is a **pre-publication requirement**. Non-blocking for a non-publishing foundation. |
| D12 approve Node/pnpm below the Dockerfile extension line? | **Resolved**: approved, preserving SpecMan's container-first model with no parallel Chatter-specific environment. |
| D14 LICENSE — MIT, Apache-2.0, or defer? | **Resolved**: MIT. Artifact creation belongs to **F3**. |
| D15 CODEOWNERS identity and interim branch-protection posture | **Resolved**: `* @ViniciusMRossi`; required approvals 0 and Code Owner review OFF while single-maintainer; PRs, status checks, conversation resolution, no force pushes and no branch deletion may still be required. Belongs to **F3**. |
| §15 feature decomposition — approve the three-feature split? | **Resolved**: approved as F1 → F2, with F3 independent where its dependencies permit. |
| R1 who owns fixing the `.specify/` container ownership defect? | **Resolved externally**: fixed in SpecMan v0.1.1, surgically repaired in this repository, re-verified in-container 2026-08-31. Must not be reopened as Phase 0 implementation work. |
| D11 `.sdd/commands.env` shape (non-blocking) | **Resolved**: schema read from the repository — six variables, no install variable. Population belongs to F1/F2 once the underlying commands exist. |
| D16 release automation (non-blocking) | **Resolved**: confirmed deferred; no Changesets or equivalent in F1. |

## If go — Handoff to `/speckit-specify`

- **Problem**: Chatter has no buildable repository and no JavaScript runtime in its canonical
  development container, so no feature can be implemented, verified, or merged under the project's
  own rules.
- **Chosen approach**: Option B — Strict-boundary foundation. Materialise the frozen layout, add the
  runtime and package-manager tooling to the existing SpecMan development container, and enforce the
  frozen dependency boundaries in layers (workspace resolution, compile graph, lint/import
  constraints, manifest meta-tests) rather than by prose. A task orchestrator and release automation
  are explicitly rejected at this scale.
- **Ratified direction**: pnpm; Node `>=24` with an exact 24.x pin in reproducible surfaces;
  TypeScript 6; ESM-only; `tsc -b` with project references and no bundler; ESLint + typescript-eslint
  type-aware + Prettier; Vitest; layered boundary enforcement; no monorepo orchestrator; release
  automation deferred; MIT; `* @ViniciusMRossi` with 0 required approvals while single-maintainer.
- **Decomposition — this handoff covers F1 only**:
  - **F1 Repository / Workspace Foundation** — the workspace, the frozen package/app skeleton, the
    runtime and language baseline, the module format, the build graph and package dependency
    direction, container runtime support, and enough commands to prove the workspace installs and
    builds. **Specify this first.**
  - **F2 Quality / Test Tooling** — lint, format, test runner, boundary meta-tests, and
    `.sdd/commands.env` population. Depends on F1.
  - **F3 Governance / Configuration** — CODEOWNERS, LICENSE, `Docs/Tech-Stack.md` rewrite, `bruno/`
    placeholder. May proceed independently where its dependencies permit.
- **In scope (F1)**: pnpm workspace foundation; root package metadata; the frozen `packages/*`,
  `apps/*` and `bruno/` skeleton; package manifests that make workspace packages real; Node 24 and
  TypeScript 6 baselines; ESM-only package foundation; TypeScript base configuration and
  project-reference structure; package dependency direction; buildable minimal packages;
  development-container Node/pnpm support; reproducible workspace installation; baseline package
  exports sufficient to constitute valid packages; enough commands to prove install and build.
- **Out of scope (F1)**: all Chatter Core behaviour; all provider behaviour and SDK integration;
  fake-provider semantics; persistence; business logic; example-client product behaviour; Bruno
  collections; lint/format/test tooling belonging to F2 beyond any minimum bootstrap strictly
  necessary to prove F1 builds; CI/governance belonging to F3; release automation; publication; any
  change to the constitution, the frozen architecture, or SpecMan mechanics.
- **Success metrics (F1)**: a clean, reproducible install succeeds inside the container from a cold
  clone; the workspace resolves every frozen package and app as a member; the package graph is valid
  and matches the frozen dependency direction; the TypeScript build succeeds across the whole
  workspace; forbidden package dependency shapes are rejected or detectable where F1 owns that
  enforcement; the container can execute the canonical workspace commands.
- **Carried-forward open questions**:
  - npm `@chatter` scope ownership — **must be evidenced before any publication**; does not block F1.
  - Exact Node 24.x and TypeScript 6.x versions — confirm against the then-current releases during
    F1 planning rather than copying a value from an assessment document.
  - R2 strict symlinked installs on the Windows bind mount — exercise during F1 implementation;
    fallbacks are a flat linker or a container-side volume, each a recorded substitution.
  - Node 26 in the CI matrix once it reaches LTS — a later decision, not Phase 0.
  - `.sdd/commands.env` population — F1 populates only what genuinely exists after F1; the rest is F2.
