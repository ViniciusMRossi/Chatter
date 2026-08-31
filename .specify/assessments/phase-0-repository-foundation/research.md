# Idea Research: Phase 0 — Chatter Repository Foundation

- **Slug**: phase-0-repository-foundation
- **Created**: 2026-08-30
- **Evidence confidence (overall)**: high

Repository-internal constraints were read directly from the frozen records and the live container.
External runtime/tooling facts were verified against primary sources on 2026-08-30 rather than
recalled, because several changed materially in 2026.

## Users & Demand

- The direct users are the Chatter implementing agents and the single human maintainer; Phase 0 is
  demanded by the frozen roadmap, not by end users — `Docs/Architecture/Implementation-Roadmap.md`
  §2 makes it the precondition for Phase 1. (confidence: high) [source: repo]
- Demand is structural: `scripts/verify.sh` exits 2 with "No verification commands configured in
  `.sdd/commands.env`. Configure them before implementation." Until Phase 0 runs, the project's
  own verification surface cannot pass. (confidence: high) [source: repo, `scripts/verify.sh`]
- The PR template requires "`bash scripts/verify.sh` passed in the canonical development
  container" for every PR, so no feature PR can satisfy its own checklist before Phase 0.
  (confidence: high) [source: repo, `.github/PULL_REQUEST_TEMPLATE.md`]

## Prior Art

- **The container has no JavaScript runtime.** `node`, `npm`, `pnpm`, `yarn`, `corepack` and `tsc`
  are all absent from `chatter-dev-1`; the image provides only `ca-certificates curl git jq
  python3 python3-pip python3-venv unzip`, `gh`, and `specify-cli`. (confidence: high)
  [source: repo, `.devcontainer/Dockerfile`; verified by executing in the running container]
- The Dockerfile ends with a sanctioned extension point: *"Project-specific runtimes and tools
  belong below this line and must be recorded in `Docs/Tech-Stack.md`."* Adding Node there is the
  mechanism's intended path, not a fork of it. (confidence: high) [source: repo]
- **CI already runs verification inside the same container.** `.github/workflows/quality.yml`
  builds the dev image and runs `bash scripts/dev.sh verify`. Consequently Phase 0 needs no
  `setup-node` step and no parallel CI toolchain — putting Node in the image serves local and CI
  execution identically. (confidence: high) [source: repo]
- **`.sdd/commands.env` has exactly six variables** and no install variable:
  `SDD_BUILD_COMMAND`, `SDD_LINT_COMMAND`, `SDD_TYPECHECK_COMMAND`, `SDD_UNIT_TEST_COMMAND`,
  `SDD_INTEGRATION_TEST_COMMAND`, `SDD_FULL_VERIFY_COMMAND`. Its header states *"Prefer a single
  `SDD_FULL_VERIFY_COMMAND` when your stack provides one."* `scripts/verify.sh` short-circuits:
  when `SDD_FULL_VERIFY_COMMAND` is set it runs **only** that and exits. (confidence: high)
  [source: repo]
- Tier 1 security is container-independent: semgrep and gitleaks each run as their own pinned
  Docker images over the repo tree, so the package-manager choice does not change them.
  (confidence: high) [source: repo, `.github/workflows/tier1-security.yml`]

## Market & Context

- **Node.js release status (2026-08-30):** v24 "Krypton" is the Active **LTS** line; v22 "Jod" is
  in maintenance (supported to 2026-07-28, i.e. now past); v26 is Current (first released
  2026-05-05) and is the next line scheduled to enter LTS; v20 "Iron" and v18 are end-of-life.
  (confidence: high) [source: https://nodejs.org/en/about/previous-releases]
- **TypeScript has moved to a native compiler.** TypeScript 7.0 — a Go rewrite reporting 8–12x
  faster full builds — is released and is the newest stable line; TypeScript 6.0 is the final
  JS-based line whose defaults and deprecations 7.0 adopts. (confidence: high)
  [source: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/]
- **TypeScript 7 does not yet expose a stable programmatic API**, which the release explicitly
  names as blocking `typescript-eslint` and webpack-style loaders; TS 7.1 is when that API is
  expected. TS 7 does support `--build`, project references, composite projects and declaration
  emit. Two default changes matter for a monorepo: `rootDir` now defaults to `./` and `types`
  defaults to `[]`. (confidence: high)
  [source: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/]
- **`require(esm)` is no longer experimental.** Loading native ES modules from CommonJS is
  unflagged by default on Node v22 and later (and was backported to v20.19), with
  `process.features.require_module` for detection. On a Node ≥24 baseline, a CommonJS consumer can
  `require()` an ESM-only package, which removes the historical reason to dual-publish.
  (confidence: high) [source: https://nodejs.org/api/esm.html]

## Data & Constraints

- Frozen workspace layout is fixed and not open for redesign: `packages/{core,testing,whatsapp,
  slack,telegram,discord}`, `apps/{validation-server,example-client}`, `bruno/`.
  [source: `Docs/Architecture/Project-Context.md` §4]
- Frozen dependency rules Phase 0 tooling must respect and ideally enforce: Core must not import
  provider SDKs; provider packages must not depend on each other; no production dependency from
  provider packages to `@chatter/testing`; apps consume Chatter as external consumers.
  [source: `Docs/Architecture/Project-Context.md` §4, `Docs/Architecture/Implementation-Roadmap.md` §2]
- Language-level requirements the TS/Node baseline must satisfy: native `Error.cause` (the error
  contract uses it rather than a competing field) and Web `ReadableStream<Uint8Array>` for
  `MediaContent`. Both are satisfied by any supported Node line today.
  [source: `Docs/Architecture/Implementation-Roadmap.md` §2, `Docs/Architecture/Core-Contract.md` §9-§10]
- Independent SemVer per package is frozen; `native`/`raw` payloads are explicit compatibility
  exclusions. [source: `Docs/Architecture/Project-Context.md` §26]
- Bruno is the approved acceptance tool, but the roadmap places the **first** Bruno collection at
  Phase 7, not Phase 0. [source: `Docs/Architecture/Implementation-Roadmap.md` §9, §23]
- Contract-first TDD is a constitutional rule: the RED phase should start from a reusable contract
  test where practical, so the test runner must support reusable, parameterised suite factories.
  [source: `.specify/memory/constitution.md` Principle XIV]
- **Environment defect found:** `.specify/` and its subdirectories are `root`-owned `drwxr-xr-x`
  inside the container, while host-created directories (`.`, `Docs`, `.sdd`, `scripts`, `.github`)
  are writable. The container's `vscode` user therefore **cannot write anywhere under `.specify/`**,
  which blocks any Spec Kit command that writes assessment artifacts, `feature.json`, or the
  constitution from inside the container — even though `AGENTS.md` mandates container-first
  execution for Spec Kit automation. (confidence: high) [source: verified by write-probe in the
  running container]

## Evidence Against the Idea

Phase 0 is mandated, so the honest counter-evidence is against *doing too much of it*, not against
doing it:

- **Premature tooling lock-in.** Phase 0 chooses the toolchain before a single line of Core exists.
  Every choice made now is made with the least information the project will ever have, and the
  frozen `Docs/Tech-Stack.md` substitution procedure makes reversing one a human-approval event.
  Mitigation: choose boring, replaceable tools and defer everything not needed to make the repo
  build.
- **Complexity that outlives its justification.** Monorepo orchestrators (Turborepo, Nx) and
  release automation (changesets) are conventional but solve problems this repository does not yet
  have: nine packages, one maintainer, no published artifact, no CI-time pain. Adopting them now
  would violate the roadmap's own preference for the least complex system that works.
- **TypeScript is mid-transition.** Adopting TS 7 immediately would buy build speed the project
  cannot yet measure while breaking `typescript-eslint`, whose type-aware rules are exactly what an
  async transport library needs. The evidence argues for the *older* stable line now and a planned
  migration, which is an uncomfortable but better-supported recommendation.
- **Bind-mount friction is real.** The workspace is a Windows bind mount into a Linux container.
  `node_modules` on that mount is slower than a native filesystem, and a package manager that
  relies on symlinks adds a second failure mode. This is an argument for keeping installs strictly
  inside the container and for treating install-layout as a revisitable decision.
- **No user-facing value ships.** Phase 0 produces an empty monorepo. Its only defensible success
  measure is that later phases become possible and verifiable — if that is not achieved, the work
  was pure overhead.

## Gaps & Open Questions

- [NEEDS CLARIFICATION: is the npm scope `@chatter` owned or available? Package naming cannot be
  frozen without this, and it is not answerable from inside the repository.]
- [NEEDS CLARIFICATION: is Chatter intended to be published publicly at 1.0, or consumed privately?
  The roadmap's "Documentation Required Before First Public Release" implies public, but the
  repository is private and no LICENSE decision has been made.]
- [NEEDS CLARIFICATION: will a second reviewer ever exist? `Docs/Repository-Settings.md` requires
  "at least one human approval", which a sole maintainer cannot satisfy without admin bypass.]
- [NEEDS CLARIFICATION: exact Node and TypeScript patch pins — these should be resolved against the
  then-current releases at implementation time, not frozen from this document.]

## Sources

- https://nodejs.org/en/about/previous-releases (host: nodejs.org, policy: allowlisted)
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (host: devblogs.microsoft.com, policy: allowlisted)
- https://nodejs.org/api/esm.html (host: nodejs.org, policy: allowlisted)
- Repository records (read-only): `Docs/Architecture/Project-Context.md`,
  `Docs/Architecture/Implementation-Roadmap.md`, `Docs/Architecture/Core-Contract.md`,
  `.specify/memory/constitution.md`, `Docs/Tech-Stack.md`, `Docs/Privacy-Compliance.md`,
  `Docs/Workflow.md`, `Docs/Repository-Settings.md`, `.devcontainer/Dockerfile`, `compose.yaml`,
  `scripts/verify.sh`, `scripts/dev.sh`, `.sdd/commands.env`, `.github/workflows/*.yml`,
  `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`
- Live container inspection of `chatter-dev-1` (runtime absence and `.specify/` write permissions)
