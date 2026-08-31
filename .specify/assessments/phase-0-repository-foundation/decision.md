# Decision: Phase 0 — Chatter Repository Foundation

- **Slug**: phase-0-repository-foundation
- **Decided**: 2026-08-30
- **Verdict**: needs-clarification
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md, feature-planning-brief.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | `scripts/verify.sh` exits 2 with no commands configured and the container has no JavaScript runtime; the roadmap makes Phase 0 the precondition for Phase 1. The problem is observable, not argued. |
| Evidence strength | strong | Constraints read directly from the frozen records; container state verified by execution; Node LTS, TypeScript 7 API gap, and `require(esm)` status verified against primary sources on 2026-08-30 rather than recalled. |
| Value vs. inaction | strong | Doing nothing blocks every downstream phase, prevents honest TDD RED evidence, and leaves three constitutional boundary rules mechanically unenforceable. |
| Feasibility / appetite | adequate | A medium appetite is credible for the recommended option, but two operational unknowns are unvalidated: strict symlinked installs on a Windows bind mount, and the `.specify/` ownership defect. |
| Strategic fit | strong | Mandated by `Docs/Architecture/Implementation-Roadmap.md` §2 and the Adoption Checklist's Phase 0 block; the recommendation deliberately honours the roadmap's least-complexity preference by rejecting an orchestrator and release automation. |
| Risk posture | adequate | Most risks are identified with concrete mitigations and documented fallbacks, but R1 is realised and unresolved today, and R2 has not been empirically tested. |

## Verdict & Rationale

**needs-clarification — pending human ratification of the technical direction, not doubt about the
milestone.**

To be unambiguous: whether Phase 0 happens is not in question. It is mandated by the frozen roadmap,
and every scorecard criterion bearing on worth is `strong`. A `kill` would contradict the
constitution, and this assessment does not propose one.

The verdict is `needs-clarification` because handing off to specification right now would over-claim
a `go`. Eleven decisions in the brief's §14 are recommendations awaiting human approval, and two of
them cannot be answered from inside the repository at all: whether the `@chatter` npm scope is
obtainable (which determines published package names) and the licence choice (a business/legal call
that the Adoption Checklist places before the first implementation commit). Freezing a `spec.md`
over unratified choices is precisely the drift the constitution's architecture-change governance
exists to prevent — and the requester has explicitly asked to approve the technical direction first.

Two operational items also need an owner before implementation. `.specify/` is root-owned inside the
container, so no Spec Kit command can write assessment artifacts, `feature.json`, or the constitution
from inside the container despite `AGENTS.md` mandating container-first execution; that is a SpecMan
bootstrap defect rather than a Chatter architecture issue, and it was worked around here rather than
fixed. Separately, strict symlinked installs on the Windows bind mount are untested, and the
fallbacks are known but unexercised.

This verdict flips to `go` as soon as the §14 decisions are answered. No further research is
required — the gap is ratification, not evidence.

## If needs-clarification

- **Blocking questions** (full detail in `feature-planning-brief.md` §14):
  - [NEEDS CLARIFICATION: D1 package manager — approve pnpm, or choose npm workspaces / Yarn?]
  - [NEEDS CLARIFICATION: D2 Node baseline — approve `>=24.0.0` on the Active LTS line?]
  - [NEEDS CLARIFICATION: D3 TypeScript — approve TS 6 now with a tracked TS 7 migration?]
  - [NEEDS CLARIFICATION: D4 module format — ESM-only, or dual ESM/CJS? Consequential and public.]
  - [NEEDS CLARIFICATION: D6 lint/format — ESLint + typescript-eslint + Prettier, or Biome?]
  - [NEEDS CLARIFICATION: D7 test runner — Vitest, or Node's built-in runner?]
  - [NEEDS CLARIFICATION: D8 is the `@chatter` npm scope owned or obtainable?]
  - [NEEDS CLARIFICATION: D12 approve adding Node/pnpm below the Dockerfile's sanctioned extension line?]
  - [NEEDS CLARIFICATION: D14 LICENSE — MIT, Apache-2.0, or defer? Is public release intended?]
  - [NEEDS CLARIFICATION: D15 CODEOWNERS identity, and the interim branch-protection posture given a single maintainer?]
  - [NEEDS CLARIFICATION: §15 feature decomposition — approve the three-feature split?]
  - [NEEDS CLARIFICATION: R1 who owns fixing the `.specify/` container ownership defect?]
- **Revisit stage**: shape — the options are shaped and the recommendation stands; what is missing is
  the human ratification recorded against it. No new intake, research, or problem work is needed.

## If go — Handoff to `/speckit-specify`

Prepared in advance, so that ratifying §14 is sufficient to proceed.

- **Problem**: Chatter has no buildable repository and no JavaScript runtime in its canonical
  container, so no feature can be implemented, verified, or merged under the project's own rules.
- **Chosen approach**: Option B — Strict-boundary foundation. Materialise the frozen layout, add the
  runtime to the container below its sanctioned extension line, and enforce the frozen dependency
  boundaries at three layers (install, compile, lint/test) rather than by prose. Explicitly reject a
  task orchestrator and release automation as unjustified at this scale.
- **In scope**: container runtime; workspace and manifests; TypeScript configuration and build
  graph; build; lint and format; test runner and Phase 0 tooling meta-tests; boundary enforcement;
  `.sdd/commands.env`; `Docs/Tech-Stack.md` updates; CODEOWNERS and LICENSE where approved; a
  `bruno/` placeholder.
- **Out of scope**: all Core behaviour; all provider behaviour; fake-provider semantics; Bruno
  collections; example-client functionality; orchestration, caching, release automation, publishing,
  dual-format builds; any change to the constitution, frozen architecture, or SpecMan mechanics.
- **Success metrics**: `bash scripts/dev.sh verify` exits 0 from a cold clone in the container
  (baseline: exits 2); runtime and toolchain present in the image (baseline: absent); all six
  `.sdd/commands.env` variables populated or justifiably empty (baseline: all empty); each of the
  three frozen boundary rules has a check that fails on a deliberately introduced violation
  (baseline: none exists); `quality.yml` passes on the Phase 0 PR.
- **Carried-forward open questions**: the §14 decisions above; the bind-mount install behaviour
  (R2) and its recorded fallbacks; the `.specify/` ownership defect (R1); confirmation of exact Node
  and TypeScript patch pins against the then-current releases at implementation time; whether Node
  26 joins the CI matrix when it reaches LTS in October 2026.
- **Proposed decomposition**: F1 workspace and build foundation → F2 quality and test tooling, with
  F3 governance and repository configuration in parallel.
