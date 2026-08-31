# Feature Planning Brief: Phase 0 — Chatter Repository Foundation

- **Slug**: phase-0-repository-foundation
- **Created**: 2026-08-30
- **Status**: NON-CANONICAL planning input. Not a specification.
- **Companion artifacts**: `intake.md`, `research.md`, `problem.md`, `concept.md`, `decision.md`

`Docs/Architecture/Project-Context.md` defines the Feature Planning Brief as discovery input to the
Spec Kit lifecycle that is explicitly **not** canonical. The canonical behavioural source remains a
human-approved `spec.md`, the canonical technical source `plan.md`, and the execution source
`tasks.md`. Nothing in this brief freezes anything.

---

## 1. Problem statement

Chatter has a ratified constitution, a frozen Core contract and a sequenced roadmap, but no
buildable repository — and the canonical development container has no JavaScript runtime at all.
Until the foundation exists, no Chatter feature can be implemented, verified through
`scripts/verify.sh`, or merged under the project's own PR requirements.

## 2. Desired outcome

An empty but fully buildable, testable and lint-clean Chatter monorepo in which:

- `bash scripts/dev.sh verify` exits 0 from a cold clone, inside the container;
- the frozen package layout exists with declared, mechanically enforced boundaries;
- `.sdd/commands.env` drives both local verification and the existing CI job;
- every consequential stack choice is recorded in `Docs/Tech-Stack.md` with rationale;
- Phase 1 can begin with no open infrastructure questions.

## 3. Scope

Container runtime provisioning; workspace and package manifests; TypeScript configuration and build
graph; lint and format baseline; test runner and Phase 0 tooling tests; boundary enforcement;
canonical SpecMan commands; `Docs/Tech-Stack.md` updates; governance configuration (CODEOWNERS,
LICENSE) where human-approved; a `bruno/` placeholder.

## 4. Explicit non-goals

- Chatter Core behaviour of any kind — refs, snapshots, content model, capabilities, handles,
  errors, Adapter SPI. All Phase 1.
- Any provider behaviour, adapter or SDK integration, including WhatsApp.
- Fake-provider semantics beyond an empty `packages/testing` skeleton (profiles are Phase 2).
- Example-client functionality or its browser bundler/transport.
- Bruno collections or any API test (first collection is Phase 7).
- Task orchestration, build caching, release automation, registry publishing, dual-format builds.
- Any change to the constitution, frozen architecture, or SpecMan workflow mechanics.
- Replacing or forking the development container; modifying `compose.yaml`.

## 5. Frozen constraints

Not open for decision in Phase 0. Sources in brackets.

| # | Constraint | Source |
|---|---|---|
| F1 | Layout: `packages/{core,testing,whatsapp,slack,telegram,discord}`, `apps/{validation-server,example-client}`, `bruno/` | Project-Context §4 |
| F2 | `@chatter/core` must not import provider SDKs; no SDK types in Core | Constitution IV |
| F3 | Provider packages must not depend on each other | Project-Context §4 |
| F4 | No production dependency from provider packages to `@chatter/testing` | Roadmap §2 |
| F5 | Apps consume Chatter as external consumers; never bypass it; no provider SDKs in browser code | Constitution XII |
| F6 | Language/runtime is Node.js + TypeScript | Project-Context §1 |
| F7 | Baseline must support native `Error.cause` and Web `ReadableStream<Uint8Array>` | Roadmap §2 |
| F8 | Independent SemVer per package; `native`/`raw` are compatibility exclusions | Project-Context §26 |
| F9 | Provider order WhatsApp → Slack → Telegram → Discord; Phase 0 implements no provider | Constitution III |
| F10 | Contract-first TDD; RED starts from a reusable contract test where practical | Constitution XIV |
| F11 | Bruno is the approved acceptance tool; first collection is Phase 7 | Roadmap §9, §23 |
| F12 | Container-first execution; installs and tests run in the container | AGENTS.md |
| F13 | Stack deviations require human approval and a recorded substitution | Constitution, Tech-Stack |

## 6–9. Technical decisions: recommendation, alternatives, trade-offs

Each row is classified **Frozen** / **Recommended** / **Deferred** / **Human-required**.
"Recommended" means I have a concrete pick that still needs your approval before `spec.md` freezes
it; "Human-required" means I decline to pick because the decision is yours by nature.

### D1 — Package manager and workspace · *Recommended*

**Recommendation: pnpm**, with `pnpm-workspace.yaml`, the workspace protocol for internal
dependencies, and the version pinned via the `packageManager` field (provisioned through corepack
in the image).

The decisive argument is not speed or disk use — it is that pnpm's strict, non-hoisted layout makes
a package able to import *only what it declares*. That converts F2/F3/F4 from prose into install-time
physics: a provider package that imports another provider package simply cannot resolve it.

- **Alternatives**: *npm workspaces* — simplest, zero extra tooling, already familiar; but it hoists,
  so undeclared cross-package imports silently succeed and the frozen boundaries stay unenforced.
  *Yarn (Berry)* — capable, and PnP is even stricter, but it adds a resolution model and editor
  integration burden disproportionate to a nine-package repo with one maintainer.
- **Trade-offs**: gains mechanical boundary enforcement and fast CI installs; costs an unfamiliar
  layout and symlink-based `node_modules` on a Windows bind mount — the main operational unknown.
  Fallback if the mount misbehaves: switch pnpm to a flat/hoisted linker (losing strictness, keeping
  the rest) and record it as a substitution.

### D2 — Node.js baseline · *Recommended*

**Recommendation**: `engines.node: ">=24.0.0"`; develop and run CI on the **Node 24 "Krypton" Active
LTS** line; pin an exact patch in the container image for reproducibility.

Verified on 2026-08-30: v24 is Active LTS; v22 "Jod" left maintenance on 2026-07-28; v20 and v18 are
EOL; v26 is Current (released 2026-05-05) and is next in line for LTS. F7 is satisfied comfortably —
`Error.cause` and global `ReadableStream` long predate this baseline, so no frozen requirement needs
inventing.

- **Alternatives**: `>=22` — broader consumer reach, but that line is already out of maintenance,
  so it would mean supporting an unsupported runtime. `>=26` — premature; not yet LTS.
- **Trade-offs**: a ≥24 floor excludes consumers pinned to older runtimes, but every such runtime is
  now EOL. Exact patch pins must be re-confirmed against the then-current release at implementation
  time rather than copied from this document.
- **Follow-up (Deferred)**: add Node 26 to the CI matrix once it enters LTS (scheduled October 2026).

### D3 — TypeScript baseline · *Recommended*

**Recommendation**: adopt the **TypeScript 6.0** line now, pinned to an exact version, and treat
migration to TypeScript 7 as a tracked follow-up rather than Phase 0 work.

This is deliberately the *older* stable line, and the reason is concrete: TypeScript 7 (the Go
rewrite, 8–12× faster full builds) **does not yet expose a stable programmatic API**, and its own
release notes name `typescript-eslint` as blocked by that gap. Type-aware lint rules are precisely
what an async transport library benefits from most, so trading them for build speed the project
cannot yet measure is a bad trade on an empty repository. TS 7 adopts TS 6's defaults and behaviour,
so the later migration should be close to mechanical.

Configuration baseline: `strict` plus the additional strictness flags; `module` and
`moduleResolution` set to `nodenext`; `target` at the highest level fully supported by the Node
baseline; `declaration`, `declarationMap` and `sourceMap` on; `composite` for project references;
`verbatimModuleSyntax` and `isolatedModules` on for predictable per-file emit.

**Set `rootDir` and `types` explicitly now.** TypeScript 7 changes their defaults (`rootDir` to
`./`, `types` to `[]`); writing them explicitly today makes the future migration a no-op instead of
a debugging session.

- **Alternatives**: *TS 7 immediately* — much faster, but sacrifices type-aware linting until 7.1.
  *TS 7 for builds + TS 6 side-by-side for linting* (supported via a compatibility package) — gets
  both, at the cost of two compilers in one repo, which contradicts the minimal-complexity
  preference on a repo with no measured build pain.
- **Trade-offs**: slower builds than the native compiler, accepted knowingly; in exchange, a single
  toolchain and full lint capability.

### D4 — Module/package strategy · *Recommended* (consequential — please rule explicitly)

**Recommendation: ESM-only.**

The historical reason to dual-publish was that CommonJS consumers could not load ESM. That reason is
gone at this baseline: `require(esm)` is unflagged by default on Node ≥22 (backported to 20.19), so
on a Node ≥24 floor a CommonJS caller can `require()` an ESM-only `@chatter/*` package. Dual
publishing would double the build and test matrix and reintroduce the dual-package hazard to solve a
problem the runtime already solved.

- **One real constraint this imposes**: `require(esm)` does not work if the entry module graph uses
  **top-level await**. Chatter package entry points must avoid TLA. This is cheap to honour now and
  expensive to retrofit, so it should appear in the spec as an explicit rule.
- Provider SDK compatibility is unaffected: ESM can import CommonJS dependencies, so a CJS-only
  provider SDK is consumable.
- **Alternatives**: *dual ESM/CJS* — maximum consumer compatibility, roughly double maintenance;
  *CJS-only* — obsolete for a new library.
- **Trade-offs**: ESM-only is simpler to build, test and reason about, and matches where the
  ecosystem is; it will still occasionally inconvenience a consumer on an old runtime or a bundler
  with weak ESM support. Reversing later (adding a CJS output) is additive and non-breaking, which
  makes this a low-regret default.

### D5 — Build tooling · *Recommended*

**Recommendation: the TypeScript compiler alone (`tsc -b`) with project references.** No bundler.

Chatter's packages are libraries consumed by Node applications; there is nothing to bundle. `tsc`
already produces the declarations, declaration maps and source maps the packages need, and build
mode gives correct incremental ordering across the workspace for free.

- **Alternatives**: *tsup* — valuable mainly for dual-format output and bundling, i.e. exactly what
  D4 declines; *rollup* — appropriate for a published bundle, not for multi-package library output.
- **Trade-offs**: slower cold builds than an esbuild-based tool, and no bundling; in return, one
  fewer tool, no output divergence between build and typecheck, and no bundler configuration to
  maintain. Revisit only if build time becomes a measured problem.
- **Deferred**: `apps/example-client` will need a browser bundler when its transport is designed —
  that belongs to its own phase, not Phase 0.

### D6 — Linting and formatting · *Recommended*

**Recommendation**: **ESLint (flat config) + typescript-eslint with type-aware rules** for
correctness, and **Prettier** for formatting. These are deliberately separate concerns: the linter
decides what is *wrong*, the formatter decides what things *look like*, and formatting must never be
a lint failure.

The Chatter-specific justification is boundary enforcement plus async correctness: import
restrictions express F2–F5 as lint rules, and type-aware rules such as no-floating-promises and
no-misused-promises catch the failure class most likely to hurt a transport library.

- **Alternatives**: *Biome* — one fast tool for both lint and format with far less configuration,
  and genuinely attractive for AI-agent ergonomics; it is the strongest alternative, and if lint
  wall-time or config burden becomes painful it is the substitution I would propose. It is not
  recommended now because type-aware rules are the reason we are linting at all.
- **Trade-offs**: ESLint is slower and more configuration than Biome; it buys type-aware analysis
  and the mature rule ecosystem for architectural boundaries.

### D7 — Unit and integration testing · *Recommended*

**Recommendation: Vitest** as the unit/contract test runner.

Phase 2 must ship *reusable contract suites* that later run against real adapters — factories
parameterised over an adapter, exported from `@chatter/testing`. Vitest supports that pattern with
first-class TypeScript and ESM, no separate build step for tests, and a coverage story available
when wanted.

- **Alternatives**: *Node's built-in test runner* — zero dependencies and a genuinely serious
  option; it costs TypeScript ergonomics (needs stripping or a build step) and is less comfortable
  for exported parameterised suite factories. If minimising dependencies is valued above test
  ergonomics, this is the substitution to make, and it is easiest to make now rather than after
  Phase 2 writes the contract framework.
- **Trade-offs**: a dependency and its config, in exchange for a runner the contract framework can
  adopt unchanged.
- **Integration testing** stays Bruno (F11), and does not exist yet — see D13.
- **Phase 0's own tests** are tooling meta-tests, not behaviour tests: assert that every package
  manifest satisfies F2–F5, that the build emits declarations and maps for every package, and that
  the workspace resolves. These are meaningful, cheap, and give Phase 0 real RED/GREEN evidence.

### D8 — Package structure and naming · *Recommended*, with one *Human-required* item

**Recommendation**: `@chatter/core` and `@chatter/testing` exactly as the architecture already names
them; provider packages as `@chatter/whatsapp`, `@chatter/slack`, `@chatter/telegram`,
`@chatter/discord`; apps (`apps/validation-server`, `apps/example-client`) marked private and never
published.

`@chatter/core` and `@chatter/testing` are used verbatim in the frozen records, so the scope is
already established there. The provider package names are a consistent extension, not a new
namespace — but they are an inference, and the spec should say so.

- **Unresolved — Human-required**: whether the **`@chatter` npm scope is owned or available**. This
  cannot be answered from inside the repository and blocks freezing published names. If the scope is
  taken, every published name changes, which is why it should be settled before `spec.md`.

### D9 — Monorepo build dependency graph · *Recommended*; orchestrator *rejected for now*

Intended direction, to be enforced at three independent layers:

```text
apps/*            →  @chatter/core, @chatter/<provider>      (consumers only)
@chatter/<provider> →  @chatter/core                          (never another provider)
@chatter/core     →  (nothing internal; no provider SDKs)
@chatter/testing  →  @chatter/core                            (dev/test dependency only)
```

1. **Install layer** — pnpm's strict resolution: undeclared imports do not resolve.
2. **Compile layer** — TypeScript project references: the build graph mirrors the architecture, and
   a reference that should not exist has to be added deliberately and visibly.
3. **Lint + test layer** — ESLint import restrictions, plus a manifest meta-test asserting that no
   provider package depends on another and that `@chatter/testing` never appears in any package's
   production `dependencies`.

**A task orchestrator is not warranted.** Turborepo and Nx solve cache and scheduling problems at a
scale this repository does not have — nine packages, one maintainer, no measured CI pain — and the
roadmap explicitly prefers the least complex system that satisfies the requirements. `pnpm -r` plus
`tsc -b` covers ordering today. Revisit only against measured build times. *(Classification:
Deferred, with a defined trigger.)*

### D10 — CI baseline · *Frozen mechanism, no Phase 0 change required*

`.github/workflows/quality.yml` already builds the dev image and runs `bash scripts/dev.sh verify`;
Tier 1 security runs semgrep and gitleaks as independent pinned images. Because CI executes
verification *inside the same container*, putting Node in the image serves local and CI identically
— **no `setup-node`, no second toolchain, and no workflow edit is needed in Phase 0.**

One real gap to design around: **CI performs no dependency install**, and the command schema has no
install variable. See D11. Future additions to identify now, implement later: contract-suite and
Bruno acceptance jobs (Phase 7+), a protected live-provider credential job (Phase 20), and
dependency caching only if CI time becomes a problem.

### D11 — `.sdd/commands.env` · *Recommended*

The file defines **exactly six variables, and there is no install variable**:

```text
SDD_BUILD_COMMAND  SDD_LINT_COMMAND  SDD_TYPECHECK_COMMAND
SDD_UNIT_TEST_COMMAND  SDD_INTEGRATION_TEST_COMMAND  SDD_FULL_VERIFY_COMMAND
```

Two behaviours matter. The file's own header says *"Prefer a single `SDD_FULL_VERIFY_COMMAND` when
your stack provides one"*, and `scripts/verify.sh` **short-circuits**: if `SDD_FULL_VERIFY_COMMAND`
is set it runs only that and exits, ignoring the other five.

Proposed values (a root `verify` script chains lint → typecheck → build → test):

```text
SDD_BUILD_COMMAND="pnpm run build"
SDD_LINT_COMMAND="pnpm run lint"
SDD_TYPECHECK_COMMAND="pnpm run typecheck"
SDD_UNIT_TEST_COMMAND="pnpm run test"
SDD_INTEGRATION_TEST_COMMAND=""            # stays empty until Phase 7 introduces Bruno
SDD_FULL_VERIFY_COMMAND="pnpm install --frozen-lockfile && pnpm run verify"
```

Folding the install into the full-verify command is what closes the CI gap without touching the
SpecMan CI workflow or inventing a variable the schema does not have. The four granular values are
populated for humans and agents running a single stage directly, even though `verify.sh` will not
reach them while full-verify is set — the spec should state that plainly so nobody later "fixes" an
apparent inconsistency. *Alternative if you would rather keep granular reporting in `verify.sh`:
leave `SDD_FULL_VERIFY_COMMAND` empty and prefix the install onto `SDD_BUILD_COMMAND`. Your call.*

### D12 — Docker / development container · *Recommended*, plus one *blocker*

**Recommendation**: add Node (pinned) and corepack-provisioned pnpm **below the Dockerfile's marked
extension line**, and record them in `Docs/Tech-Stack.md`. The Dockerfile itself says
*"Project-specific runtimes and tools belong below this line and must be recorded in
`Docs/Tech-Stack.md`"*, so this is the sanctioned extension path, not a fork. **No `compose.yaml`
change is proposed**, and the container mechanism is otherwise untouched.

Because this touches `.devcontainer/`, which is normally SpecMan-owned, it is called out explicitly
for your approval rather than treated as routine.

**Blocker found during this assessment**: `.specify/` and its subdirectories are `root`-owned
`drwxr-xr-x` inside the container, while host-created directories are writable. The container's
`vscode` user therefore **cannot write anywhere under `.specify/`** — which blocks any Spec Kit
command that writes assessment artifacts, `feature.json`, or the constitution from inside the
container, even though `AGENTS.md` mandates container-first execution for Spec Kit automation. This
is a SpecMan bootstrap defect, not a Chatter architecture issue; it needs an ownership fix (or an
upstream bootstrap fix) before container-side Spec Kit writes work. I have not changed it.

*(Also worth noting: `node_modules` will live on a Windows bind mount. Keep all installs inside the
container per F12. If performance or symlinks misbehave, the fallbacks are a flat pnpm linker or
moving `node_modules` to a container-side volume — the latter would require a `compose.yaml` change
and should be a separate, deliberate decision.)*

### D13 — Bruno · *Recommended (minimal)*

**Recommendation**: Phase 0 creates the `bruno/` directory with a short README stating that
collections arrive in Phase 7. Nothing else — no CLI dependency, no collection, no API tests, and
`SDD_INTEGRATION_TEST_COMMAND` stays empty.

The roadmap places the first minimal Bruno collection at Phase 7, against the fake provider. Creating
tests for APIs that do not exist would be exactly the premature work the roadmap warns against.

### D14 — LICENSE · *Human-required*

**Recommendation for your decision: MIT**, with **Apache-2.0** as the considered alternative.

Chatter is intended as an externally consumed Node library (the roadmap has a "Documentation
Required Before First Public Release" section). MIT is the dominant Node-ecosystem licence, is the
least friction for consumers and their legal review, and is what most integration libraries use.
Apache-2.0's differentiator is an explicit patent grant plus a defensive patent-termination clause,
which some corporate consumers prefer; it costs a NOTICE convention and slightly more ceremony.

For a provider-integration library with no patent strategy, MIT is the better default; choose
Apache-2.0 if you expect enterprise adopters who ask for an explicit patent grant. **This is a
business/legal decision and I am not making it.** Note also that the repository is currently private,
so "public release" is itself an assumption worth confirming. Phase 0 adds the file only once you
decide, and the licence should then appear both as a root `LICENSE` and in each package manifest.

### D15 — CODEOWNERS · *Human-required*

`.github/CODEOWNERS` currently contains only a commented example, which is why `scripts/dev.sh
check` warns. The appropriate entry for a single-maintainer repository is a global owner:

```text
* @ViniciusMRossi
```

Using `ViniciusMRossi` is consistent with the configured remote (`git@github.com:ViniciusMRossi/chatter.git`),
so it is very likely correct — but confirm it is the intended GitHub identity for code ownership
rather than merely the account that created the repo.

**Before enabling Code Owner branch protection, note a practical conflict.**
`Docs/Repository-Settings.md` asks for "require at least one human approval" *and* "require review
from Code Owners". GitHub does not let an author approve their own pull request, so with one
maintainer those two settings together make it impossible to merge your own PRs without an admin
bypass — and the same document says the agent must not bypass protection. Recommended interim
posture: set the CODEOWNERS entry now, enforce **required status checks** (`verify`, `semgrep`,
`gitleaks`) plus no-force-push, and defer required approvals/code-owner review until a second
reviewer exists. That is a governance decision, so it is yours.

### D16 — Versioning and publishing baseline · *Frozen intent, mechanism Deferred*

Independent SemVer per package is frozen (F8). Phase 0 needs only what makes that possible: a
`version` field in each publishable manifest, apps marked private, internal dependencies expressed
via the workspace protocol, and per-package `engines`.

**Release automation is not justified now.** Changesets and similar tools coordinate versioning and
changelogs across packages that are *actually published*; nothing is published, there are no
consumers, and the 1.0 target is far downstream. Adopting it now means configuring a release process
against imagined constraints and reconfiguring it at first publish. **Recommendation: defer**, with
a clear trigger — introduce changesets when the first package is genuinely published, or earlier if
two or more packages need coordinated releases.

### D17 — Security baseline · *Frozen, minor Phase 0 obligations*

Tier 1 is unaffected by the package-manager choice: semgrep and gitleaks each run as pinned Docker
images over the repository tree, independent of the Node toolchain. No new security system is
warranted.

Phase 0 obligations that follow from the stack: commit the lockfile and install with
`--frozen-lockfile` in verification so builds are reproducible and auditable; keep `node_modules`
and build outputs git-ignored (the existing `.gitignore` already covers `node_modules/`, `dist/`,
`build/`, `coverage/`) so gitleaks does not scan dependency trees. Expect semgrep to begin producing
TypeScript findings once real code exists — `Docs/Repository-Settings.md` already requires validating
diff-awareness on the first real PR, which Phase 0's PR will be the first opportunity to do.

For dependency vulnerability alerting, prefer enabling **Dependabot** as a repository setting
(native, no new tooling, supports pnpm) over adding a scanner to CI. That is a repository-settings
action, not a Phase 0 code change.

## 10. Repository artifacts Phase 0 is expected to create or modify

**Create**

- `pnpm-workspace.yaml`, root `package.json`, `.npmrc`
- `tsconfig.base.json` and a root solution `tsconfig.json`
- Per package/app: `package.json`, `tsconfig.json`, minimal `src/index.ts` placeholder
  (`packages/core`, `packages/testing`, `packages/{whatsapp,slack,telegram,discord}`,
  `apps/validation-server`, `apps/example-client`)
- `eslint.config.js`, Prettier configuration
- Vitest configuration
- Phase 0 tooling tests (manifest/boundary meta-tests, build-output assertions)
- `bruno/README.md` placeholder
- `LICENSE` — only if approved (D14)

**Modify**

- `.devcontainer/Dockerfile` — Node + pnpm **below the marked extension line** only (D12)
- `.sdd/commands.env` — populate (D11)
- `Docs/Tech-Stack.md` — replace every "Phase 0 decision" marker with the approved choice
- `.gitignore` — only if the chosen build outputs are not already covered
- `.github/CODEOWNERS` — only if approved (D15)

**Explicitly not touched**: `compose.yaml`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
`.specify/memory/constitution.md`, every `Docs/Architecture/` record, SpecMan scripts, CI workflows.

## 11. Acceptance criteria (milestone level)

1. `bash scripts/dev.sh verify` exits 0 from a clean checkout, inside the container.
2. `node`, the package manager and the TypeScript compiler are all available in the container image
   at the pinned versions, and the versions are recorded in `Docs/Tech-Stack.md`.
3. Every frozen directory in F1 exists as a workspace member and resolves.
4. A single root build command produces declarations, declaration maps and source maps for every
   package.
5. Each of F2, F3 and F4 has an automated check that **fails** when the violation is deliberately
   introduced, and passes otherwise — demonstrated as RED/GREEN evidence, not asserted.
6. Lint and format run clean, and formatting is not a lint failure.
7. `.sdd/commands.env` is populated, with any intentionally empty variable justified in the spec.
8. `Docs/Tech-Stack.md` contains no remaining "Phase 0 decision" placeholder for a decided item.
9. The `quality.yml` PR job passes on the Phase 0 pull request.
10. No Core, provider, fake-provider, Bruno or example-client behaviour has been implemented.
11. The `AGENTS.md` authority-wiring check still passes after the documentation changes
    (an explicit Adoption Checklist item).

## 12. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | `.specify/` is root-owned in the container, blocking container-side Spec Kit writes | **High — already realised** | Fix ownership during Phase 0 or upstream in SpecMan bootstrap; until then Spec Kit artifact writes happen host-side. Raise with the workflow owner. |
| R2 | Strict symlinked `node_modules` on a Windows bind mount is slow or breaks | Medium | Install only inside the container (F12); timebox debugging; fallbacks are a flat linker or a container-side volume, each recorded as a substitution |
| R3 | CI performs no dependency install and the schema has no install variable | Medium | Fold install into `SDD_FULL_VERIFY_COMMAND` (D11) — no CI edit, no schema invention |
| R4 | TypeScript ecosystem mid-transition; choosing TS 6 now means a migration later | Medium | Pin exact version; set `rootDir`/`types` explicitly so migration is near-mechanical; revisit at TS 7.1 |
| R5 | Premature tooling lock-in on an empty repository | Medium | Prefer boring, replaceable tools; record every choice in `Docs/Tech-Stack.md` so substitution follows the approved procedure |
| R6 | Solo-maintainer approval deadlock if code-owner review is required | Medium | Enforce status checks now, defer required approvals until a second reviewer exists (D15) |
| R7 | Scope creep from "skeleton" into Phase 1 Core behaviour | Medium | Placeholders stay empty; acceptance criterion 10 makes the absence checkable; decomposition keeps PRs small |
| R8 | ESM-only inconveniences a consumer | Low–Medium | Node ≥24 floor makes `require(esm)` work; forbid top-level await in entry graphs; adding a CJS output later is additive, not breaking |
| R9 | `@chatter` npm scope unavailable | Low probability, high rework | Resolve before `spec.md` freezes published names (D8) |
| R10 | semgrep noise once TypeScript exists | Low | Validate diff-awareness on the first real PR, as `Docs/Repository-Settings.md` already requires |

## 13. Dependencies

- **Human decisions** in §14 — several block `spec.md`, not just implementation.
- **Docker + network access** to install Node and pnpm into the image at build time.
- **The existing container and CI mechanism** (`scripts/dev.sh`, `verify.sh`, `quality.yml`) — used
  as-is, not modified.
- **`Docs/Tech-Stack.md` substitution procedure** — the route for any later change.
- **No dependency on any other roadmap phase.** Phase 0 is the root of the graph; Phase 1 and the
  Phase 2 contract framework depend on it.

## 14. Human decisions required before `/speckit-specify`

**Blocking — the specification cannot freeze these without you:**

1. **D1 Package manager** — approve pnpm, or choose npm workspaces / Yarn.
2. **D2 Node baseline** — approve `>=24.0.0` on the Active LTS line.
3. **D3 TypeScript line** — approve TS 6 now with a tracked TS 7 migration, or direct otherwise.
4. **D4 Module format** — approve ESM-only, or require dual ESM/CJS. Consequential and public.
5. **D6 Lint/format** — approve ESLint + typescript-eslint + Prettier, or choose Biome.
6. **D7 Test runner** — approve Vitest, or choose Node's built-in runner.
7. **D8 npm scope** — confirm `@chatter` is owned or obtainable.
8. **D12 Dockerfile change** — approve adding Node/pnpm below the sanctioned extension line.
9. **D14 LICENSE** — MIT, Apache-2.0, or defer (and confirm public-release intent).
10. **D15 CODEOWNERS** — confirm `@ViniciusMRossi`, and decide the interim branch-protection posture.
11. **Feature decomposition** — approve the three-feature split in §15, or ask for a different one.

**Non-blocking, but worth an explicit answer:**

12. **D11** — full-verify-with-install (recommended) vs granular commands with install prefixed.
13. **R1** — who owns fixing the `.specify/` ownership defect, and whether Phase 0 may fix it locally.
14. **D16** — confirm release automation is deferred rather than set up now.

## 15. Proposed feature decomposition

Phase 0 is too large for one reviewable PR: it spans container provisioning, workspace mechanics,
quality tooling and governance, which have different reviewers' concerns and different failure
modes. The roadmap explicitly says a phase is *not* automatically one feature. Recommended split —
**three features, three branches, three PRs**:

### F1 — Workspace and build foundation

- **Purpose**: make the repository build. Container runtime (D12), workspace and manifests (D1, D8),
  TypeScript configuration and project references (D3, D9), build (D5), module format decision
  materialised (D4), the frozen layout created (F1).
- **Dependencies**: human decisions 1, 2, 3, 4, 7, 8. No dependency on other features.
- **Expected verification**: the root build produces declarations, maps and source maps for every
  package from a cold clone inside the container; workspace resolution succeeds; a deliberately
  introduced cross-provider import fails to resolve (install-layer RED/GREEN evidence).
- **Why this boundary**: it is the only feature that must exist before anything else can be
  verified, and it is the one whose review is about *architecture conformance* — the boundary
  layers of D9 — rather than about tooling taste.

### F2 — Quality and test tooling

- **Purpose**: make the repository *checkable*. Lint and format (D6), test runner (D7), Phase 0
  tooling meta-tests, and `.sdd/commands.env` population (D11) so `verify.sh` and CI go green.
- **Dependencies**: F1 must be merged — there is nothing to lint, typecheck or test before it.
  Human decisions 5, 6, 12.
- **Expected verification**: `bash scripts/dev.sh verify` exits 0; the manifest meta-tests fail on a
  deliberately introduced `@chatter/testing` production dependency and pass once reverted; lint and
  format run clean; the `quality.yml` job passes on the PR.
- **Why this boundary**: this is where Phase 0 earns genuine TDD evidence — the boundary meta-tests
  are real RED-first tests — and separating it keeps F1's diff reviewable as structure rather than
  as a wall of tool configuration.

### F3 — Governance and repository configuration

- **Purpose**: close the governance items — CODEOWNERS (D15), LICENSE if approved (D14), the
  `Docs/Tech-Stack.md` rewrite recording every approved decision, Dependabot/branch-protection
  guidance, and the `bruno/` placeholder (D13).
- **Dependencies**: **none on F1/F2** — it touches no code and can run in parallel or first once its
  human decisions land. Human decisions 9, 10.
- **Expected verification**: `scripts/dev.sh check` no longer warns about CODEOWNERS; the
  `AGENTS.md` authority-wiring check still passes; `Docs/Tech-Stack.md` has no stale "Phase 0
  decision" placeholder.
- **Why this boundary**: these are human/legal decisions with no build consequence. Bundling them
  into a code PR would hold the foundation hostage to a licensing decision, and vice versa.

**Sequencing**: F1 → F2, with F3 in parallel. If you prefer the smallest possible first PR, F1 can
be split further (container runtime; then workspace), but I do not recommend it — the container
change is unverifiable on its own, since nothing can run until there is a workspace to build.

---

## Decision classification summary

| ID | Decision | Classification | Recommendation |
|---|---|---|---|
| D1 | Package manager / workspace | Recommended | pnpm + workspace protocol |
| D2 | Node baseline | Recommended | `>=24.0.0`, Node 24 LTS, exact pin in image |
| D3 | TypeScript baseline | Recommended | TS 6 now; TS 7 migration tracked |
| D4 | Module format | Recommended (consequential) | ESM-only; no top-level await in entries |
| D5 | Build tooling | Recommended | `tsc -b` with project references; no bundler |
| D6 | Lint / format | Recommended | ESLint + typescript-eslint + Prettier |
| D7 | Test runner | Recommended | Vitest; Bruno remains acceptance (Phase 7) |
| D8 | Package naming | Recommended | `@chatter/*`; **scope ownership Human-required** |
| D9 | Dependency graph enforcement | Recommended | Three layers; orchestrator **Deferred** |
| D10 | CI baseline | Frozen mechanism | No Phase 0 workflow change needed |
| D11 | `.sdd/commands.env` | Recommended | Full-verify with install; granular populated |
| D12 | Container | Recommended | Node + pnpm below extension line; no compose change |
| D13 | Bruno | Recommended | Directory + README placeholder only |
| D14 | LICENSE | **Human-required** | MIT (alternative: Apache-2.0) |
| D15 | CODEOWNERS | **Human-required** | `* @ViniciusMRossi`; defer required approvals |
| D16 | Release automation | Deferred | No changesets until first publish |
| D17 | Security baseline | Frozen | Lockfile + `--frozen-lockfile`; Dependabot as a setting |
| — | Frozen layout, boundaries, provider order, TDD, Bruno-as-tool | Frozen | No decision required |
