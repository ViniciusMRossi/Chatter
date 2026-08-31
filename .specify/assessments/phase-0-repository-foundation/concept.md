# Concept: Phase 0 — Chatter Repository Foundation

- **Slug**: phase-0-repository-foundation
- **Created**: 2026-08-30
- **Recommended option**: Option B — Strict-boundary foundation

All three options materialise the same frozen layout and add Node to the container; they differ in
how much enforcement and machinery they buy at the same time.

## Options

### Option A — Minimum viable workspace

- **Sketch**: The smallest thing that could work. Add a JavaScript runtime to the container, create
  the frozen package and app directories with manifests, one TypeScript configuration inherited by
  every package, and compile with the TypeScript compiler alone. Use the runtime's built-in test
  runner, skip a formatter, and rely on human review to keep the frozen dependency boundaries.
  Populate the SpecMan verification commands and stop.
- **Appetite**: small (days)
- **Trade-offs**: Wins the fastest route to a green `verify.sh`, the fewest dependencies to
  maintain, and the least to unlearn if the toolchain is later replaced. Sacrifices boundary
  enforcement entirely — with a hoisting installer, a provider package can import another provider
  package, or `@chatter/testing`, and nothing fails. It also sacrifices type-aware linting, which
  is the class of check most valuable for an async transport library, and leaves formatting
  non-deterministic across contributors and agents.
- **Rabbit holes**: Retrofitting boundary enforcement later is far more disruptive than adding it
  now, because by then real imports exist and the violations must be untangled. A test runner
  chosen for minimalism may be re-chosen once reusable contract-suite factories are actually
  written in Phase 2, wasting the Phase 0 work.

### Option B — Strict-boundary foundation

- **Sketch**: Same materialised layout and container runtime, but the installer itself enforces
  dependency isolation: a package can only import what it declares. The TypeScript layer uses
  project references so the build graph mirrors the architectural graph, linting is type-aware and
  carries explicit import-restriction rules for the frozen boundaries, formatting is a separate
  deterministic tool, and the test runner is chosen for first-class TypeScript and reusable
  parameterised suites so Phase 2's contract framework drops straight in. Phase 0's own tests are
  meta-tests: they read the package manifests and assert the frozen rules hold. Verification
  commands are wired to SpecMan so local and CI runs are the same command.
- **Appetite**: medium (weeks)
- **Trade-offs**: Wins mechanical enforcement of rules the constitution treats as non-negotiable,
  turning three prose invariants into failing checks. Wins a test and lint story that Phase 1 and
  Phase 2 can adopt without revisiting. Sacrifices some simplicity — more devDependencies, a
  strict install layout that behaves differently from the familiar hoisted one, and symlink-based
  installs on a Windows bind mount, which is the main operational unknown.
- **Rabbit holes**: Project references can consume disproportionate time if package graphs are
  fiddled with before any real code exists — keep the graph flat and shallow. Chasing perfect lint
  configuration, or writing elaborate custom boundary rules, is scope creep; the manifest meta-test
  covers most of the value cheaply. Debugging install-layout problems on the bind mount could
  expand without a timebox and a documented fallback.

### Option C — Fully orchestrated monorepo

- **Sketch**: Option B plus the conventional monorepo machinery: a task orchestrator with caching
  in front of the build, release automation for versioning and changelogs, and dual-format
  publishing so both module systems are supported from day one.
- **Appetite**: large (months, relative to the value delivered)
- **Trade-offs**: Wins faster incremental builds at scale and a ready-made release process.
  Sacrifices the roadmap's stated preference for the least complex system that works, and pays
  ongoing maintenance for problems the project does not have: nine packages, one maintainer,
  nothing published, and no measured CI pain. Dual-format publishing in particular doubles the
  build and test matrix and reintroduces the dual-package hazard at exactly the moment the runtime
  baseline has made it unnecessary.
- **Rabbit holes**: Orchestrator caching is a persistent source of "works locally, fails in CI"
  confusion. Release automation configured before anything is published tends to be re-configured
  when it finally is. Dual publishing invites subtle divergence between the two builds that only
  surfaces in consumer bug reports.

## Recommendation

**Option B.** It is the only option that makes the constitution's frozen dependency boundaries
mechanically true rather than aspirational — Core must not import provider SDKs, provider packages
must not depend on each other, and production packages must not depend on `@chatter/testing`. Those
are exactly the rules a repository foundation is in a position to enforce and that become expensive
to impose later, once real imports exist.

It also fits the success metrics directly: a green `scripts/dev.sh verify` from a cold clone, a
failing check for each boundary rule, and a test story Phase 2's contract framework can adopt
unchanged. Option A reaches a green verification sooner but leaves the project's most important
invariants unenforced and likely re-opens the test-runner decision in Phase 2. Option C buys
machinery for problems that do not exist yet and contradicts the roadmap's own instruction not to
introduce a heavyweight orchestrator without demonstrated need.

The distinguishing risk of Option B — strict, symlink-based installs on a Windows bind mount —
is contained rather than eliminated: all installs already must run inside the container under
`AGENTS.md`, and a documented flat-install fallback exists if the mount misbehaves.

## Out of Scope (for the recommended option)

- All Phase 1 Core behaviour and all provider behaviour, including WhatsApp.
- Fake-provider profiles and semantics (Phase 2); at most an empty `packages/testing` skeleton.
- Bruno collections and any API test (first collection is Phase 7).
- Example-client functionality and its browser transport/bundler.
- A task orchestrator, build caching, and release automation.
- Publishing to a registry, and any dual-format build.
- Changes to the constitution, frozen architecture, or SpecMan workflow mechanics.
- Modifying `compose.yaml` or replacing the development container.

## Assumptions to Validate

- That adding a runtime below the Dockerfile's marked extension line is the sanctioned way to
  extend the container, and needs no `compose.yaml` change. (The Dockerfile comment says so;
  confirm no SpecMan check objects.)
- That folding dependency installation into the SpecMan verification command is acceptable, since
  the command schema has no install variable and CI performs no install step.
- That strict, symlink-based installs behave acceptably on the Windows bind mount; if not, the
  flat-install fallback is taken and recorded as a substitution.
- That an ESM-only publishing model is acceptable to intended consumers, given the runtime baseline
  now lets CommonJS callers load ES modules.
- That the `@chatter` npm scope is obtainable — package naming cannot be frozen otherwise.
- That a single maintainer is the near-term reality, which determines whether code-owner review can
  be a required merge gate.
