# Implementation Plan: Repository / Workspace Foundation

**Branch**: `001-repository-workspace-foundation` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-repository-workspace-foundation/spec.md`
(human-approved 2026-08-31)

**Status**: Approved for task generation

**Human Plan Approval**: 2026-08-31 — **APPROVED**. One remaining non-blocking P2 documentation
finding was reviewed and explicitly accepted by the approver; it does not gate task generation or
implementation.

## Summary

Make the Chatter repository buildable for the first time, without introducing a single line of
product behaviour.

The approach: extend the existing SpecMan development image with a checksum-verified Node.js
`24.20.0` and a pinned pnpm `11.24.0` installed to system paths; declare a pnpm workspace whose
members are exactly the eight frozen packages and applications; give every member a manifest, a
TypeScript project and a one-line `export {};` entry module; wire the architectural dependency
direction into both the manifests and a TypeScript project-reference graph so a single `tsc -b`
builds all eight in the correct order; commit a lockfile and verify from it with
`--frozen-lockfile`; and route `scripts/dev.sh verify` through one honest full-verification command
that does exactly and only what F1 provides.

Everything F1 does is structural. The only "code" in the feature is eight modules whose entire
content is `export {};` — chosen precisely because it is buildable, emits the full declaration and
source-map output contract, and exports nothing.

## Technical Context

**Language/Version**: TypeScript `6.0.3` (exact pin) targeting Node.js `>=24.0.0`; development and
CI image pinned to Node.js `24.20.0`

**Primary Dependencies**: exactly one — `typescript@6.0.3` as a root devDependency. No runtime
dependency, no `@types/*`, no bundler, no orchestrator, no test runner, no linter. pnpm `11.24.0` is
provisioned by the image, not by the dependency graph.

**Storage**: N/A — this feature introduces no persistence of any kind

**Testing**: none introduced. F1's evidence is objective repository behaviour: a reproducible
frozen-lock install, a successful ordered root build with the required emit, an exact
workspace-member and dependency-edge enumeration, an undeclared-import rejection probe, and a runtime
baseline-capability probe. The test runner and contract-first harness are F2.

**Target Platform**: Linux inside the canonical development container (`chatter-dev`), on amd64 and
arm64 hosts; consumers are Node.js applications

**Project Type**: TypeScript monorepo — six library packages plus two applications, built with the
TypeScript compiler alone

**Performance Goals**: none are specified or measured. Build performance is explicitly not a driver
of any decision here; the roadmap's least-complexity preference is.

**Constraints**: container-first execution; ESM-only with synchronously loadable entry graphs; frozen
package layout and dependency direction; no publication and no assumption of registry scope
ownership; F1 owns only the workspace-resolution and project-reference enforcement layers

**Scale/Scope**: eight workspace members; one dependency edge type; ~22 new files and 4 modified
files; zero behavioural surface

## Constitution Check

*GATE: evaluated before Phase 0 research and re-evaluated after Phase 1 design. Both evaluations
reached the same result.*

| Principle | Verdict | Basis |
|---|---|---|
| I — Product Boundary | **PASS** | No product surface exists after F1. No application state, no conversation model, nothing Chatter is or is not allowed to own is created. |
| II — Single integration surface | **N/A** | No API is introduced, so no normalization decision is taken. |
| III — Strict provider order, depth-first | **PASS** | No provider is implemented. `packages/whatsapp`, `slack`, `telegram` and `discord` receive a manifest, a TypeScript project and an `export {};` entry — this is the frozen *layout*, not the beginning of provider feature work. No provider SDK is added; no adapter, normalization or capability code exists. Creating the directory the roadmap already froze does not start a provider feature. |
| IV — Core Isolation | **PASS** | `@chatter/core` declares **zero** dependencies — internal or external — and has no project references. A provider SDK cannot leak into a package that depends on nothing. |
| V — Identity and semantic fidelity | **N/A** | No refs, snapshots or identity model exist yet. |
| VI — Rule N (no implicit I/O) | **N/A** | No normalization path exists. |
| VII — Capabilities and authorization | **N/A** | No capability registry exists. |
| VIII — Lifecycle | **N/A** | No lifecycle exists. |
| IX — Persistence and provider policy | **PASS** | No persistence, no history, no shadow state. |
| X — Outbound safety | **N/A** | No send path exists. |
| XI — Media and browser boundaries | **PASS** | No browser code, no credentials, no media transport. `apps/example-client` is an empty compiled module with no transport. |
| XII — Example Client Boundary | **PASS** | `apps/example-client` is `private`, declares only `@chatter/core`, declares no provider package and no provider SDK, and contains nothing that could bypass Chatter. |
| XIII — Errors and observability | **PASS** | No logging, no error taxonomy, no diagnostics are introduced, so no default-logging rule can be violated. |
| XIV — Contract-First Testing | **PASS, with recorded rationale** | The rule applies "when behavior is represented by a reusable Chatter adapter contract". F1 has no behaviour and no contract suite; inventing a failing behavioural test for an empty module would be a ritual, not evidence. See *TDD posture* below. |
| XV — Core Freeze Gate | **PASS** | F1 is Phase 0. The gate governs entry to Phase 8 and is untouched. |
| Authority model | **PASS** | This plan makes no decision that overrides the approved `spec.md`, the constitution or a frozen architecture record. Its version selections fill gaps the spec explicitly delegated to planning (FR-008, FR-010, FR-027). |
| `Docs/Tech-Stack.md` substitution rule | **PASS** | No substitution is proposed. The one path that *would* be a substitution — falling back to a hoisted node-modules layout — is identified in advance and routed to human approval rather than implementer discretion (see Risk R-1). |
| `Docs/Privacy-Compliance.md` | **PASS** | F1 handles no personal data, adds no credential, no logging surface and no provider identifier. Nothing in the privacy record applies beyond the standing "no secrets in the repository" rule, which is unaffected. |

**TDD posture (AGENTS.md).** F1 changes no behaviour, so a meaningful behavioural RED is not
practical. The implementation records a human-reviewable rationale with
`bash scripts/tdd-evidence.sh skip …` rather than manufacturing a failing test for `export {};`.
One genuine observed-failure/observed-pass cycle *is* recorded, because it is real rather than
ceremonial: the undeclared cross-package import probe (D13 `P-UNDECLARED`) is introduced, observed to fail
the build, reverted, and the build observed to pass again. That is the evidence SC-005 asks for.

**Result: no gate violations.** One deliberate deviation from a *literal* reading of FR-015 is
recorded in Complexity Tracking; it is a build-mechanism consequence, not a constitutional issue.

## Project Structure

### Documentation (this feature)

```text
specs/001-repository-workspace-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output — version selection and mechanism evidence
├── data-model.md        # Phase 1 output — workspace/member/edge metadata model
├── quickstart.md        # Phase 1 output — how to validate F1 end to end
├── contracts/
│   └── workspace-member.contract.md   # Required manifest/tsconfig/entry shape per member
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
├── spec.md              # Approved specification
└── tasks.md             # NOT created by this command
```

### Source Code (repository root)

```text
package.json                     # NEW — private root; workspace scripts; engines; packageManager
pnpm-workspace.yaml              # NEW — members + pnpm settings (pnpm 11 reads settings here)
pnpm-lock.yaml                   # NEW — generated, committed
tsconfig.base.json               # NEW — shared compiler options
tsconfig.json                    # NEW — solution file: `files: []` + references to all eight

packages/
├── core/          { package.json, tsconfig.json, src/index.ts }
├── testing/       { package.json, tsconfig.json, src/index.ts }
├── whatsapp/      { package.json, tsconfig.json, src/index.ts }
├── slack/         { package.json, tsconfig.json, src/index.ts }
├── telegram/      { package.json, tsconfig.json, src/index.ts }
└── discord/       { package.json, tsconfig.json, src/index.ts }

apps/
├── validation-server/  { package.json, tsconfig.json, src/main.ts }
└── example-client/     { package.json, tsconfig.json, src/main.ts }

bruno/
└── .gitkeep                     # NEW — directory exists; no collections (README is F3)

.devcontainer/Dockerfile         # MODIFIED — Node + pnpm below the sanctioned extension line
.sdd/commands.env                # MODIFIED — SDD_FULL_VERIFY_COMMAND only
.gitignore                       # MODIFIED — add *.tsbuildinfo
Docs/Tech-Stack.md               # MODIFIED — narrow factual recording (FR-028 scope only)
```

**Structure Decision**: the layout is not chosen — it is frozen by
`Docs/Architecture/Project-Context.md` §4 and restated in the approved spec. This plan materializes
exactly that tree and adds nothing beside it. Build output lands in a per-member `dist/`, already
covered by `.gitignore`.

**Explicitly not touched**: `compose.yaml`, `.github/workflows/*`, `AGENTS.md`, `CLAUDE.md`,
`GEMINI.md`, `.specify/memory/constitution.md`, every record under `Docs/Architecture/`, and every
script under `scripts/`.

---

## Design

### D1 — Workspace definition

`pnpm-workspace.yaml` declares the members and, because **pnpm 11 reads its settings from this file
rather than `.npmrc`** (research R2), also carries the workspace settings:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'

pmOnFail: error        # fail loudly if the running pnpm differs from the declared packageManager
engineStrict: true     # refuse to install under a Node that does not satisfy `engines`
nodeLinker: isolated   # stated explicitly; this is what makes FR-025 true
```

`bruno/` is deliberately **not** a member — it is a reserved acceptance-collection directory, not a
package (FR-006).

**No `.npmrc` is created.** In pnpm 11 that file is auth/registry only, so an `.npmrc` carrying
settings would be silently ignored — a trap for a later reader. This corrects an assumption carried
in the assessment brief.

`nodeLinker: isolated` is pnpm's default; it is written explicitly because FR-025 depends on it and a
future reader must see that it is load-bearing rather than incidental.

### D2 — Root manifest

`package.json` at the root is `private: true`, `name: "chatter"`, `type: "module"`, declares
`engines.node: ">=24.0.0"` and `packageManager: "pnpm@11.24.0"`, holds the single devDependency
`typescript: "6.0.3"` (exact, no range prefix), and defines three scripts:

| Script | Body | Why it exists |
|---|---|---|
| `build` | `tsc -b` | FR-014's single root build |
| `clean` | `tsc -b --clean` | needed to produce honest cold-build evidence for SC-001/SC-003 |
| `verify` | `pnpm run build` | the seam F2 extends; in F1 it genuinely does only what it says |

The `verify` script is the one piece of indirection in the plan and it is justified: without it, F2
must edit `.sdd/commands.env` to add lint and tests; with it, F2 edits one script. It claims nothing
F1 does not do.

The root manifest carries a `name` (`chatter`) even though it is private and unpublishable. That is
not decoration: the workspace root is itself a pnpm project and appears in recursive command output,
so giving it an identity is what lets the membership enumeration in D13 distinguish the root from the
eight members deterministically rather than by counting.

### D3 — Member manifests

**Six library packages** (`@chatter/core`, `@chatter/testing`, `@chatter/whatsapp`, `@chatter/slack`,
`@chatter/telegram`, `@chatter/discord`):

- `name`: the approved `@chatter/<name>` convention (FR-003)
- `version`: `0.0.0` — independent per package (FR-005). `0.0.0` states plainly that nothing has been
  released; real SemVer begins when a package first ships. `0.1.0` would be an equally valid choice
  and is a one-line change.
- `type`: `"module"` (FR-012)
- `engines.node`: `">=24.0.0"` (FR-007)
- `exports`: `{ ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }`
- **no** `main`, no `files`, no `publishConfig`, no `prepublish*` script — F1 publishes nothing and
  must not look like it is preparing to (FR-034)

**Two applications** (`apps/validation-server`, `apps/example-client`):

- `name`: a plain unscoped identity (`chatter-validation-server`, `chatter-example-client`) — using
  the `@chatter/*` scope for something that will never be published would misrepresent the convention
- `private`: `true` (FR-004)
- `type`: `"module"`; `engines.node`: `">=24.0.0"`
- **no** `exports` map — applications are not consumable packages
- **no** `version` field, because the spec deliberately imposes no independent-version requirement on
  applications. *Implementation note*: if pnpm or the workspace tooling turns out to require a
  `version` on a private member, `"0.0.0"` is the fallback — it satisfies the tool while asserting
  no versioning intent. Confirm at implementation time rather than guessing now.

### D4 — Declared dependency edges

F1 declares the architecturally correct edges rather than leaving the graph empty:

```text
@chatter/testing   → @chatter/core        (dependencies, workspace:*)
@chatter/whatsapp  → @chatter/core        (dependencies, workspace:*)
@chatter/slack     → @chatter/core        (dependencies, workspace:*)
@chatter/telegram  → @chatter/core        (dependencies, workspace:*)
@chatter/discord   → @chatter/core        (dependencies, workspace:*)
validation-server  → @chatter/core        (dependencies, workspace:*)
example-client     → @chatter/core        (dependencies, workspace:*)
@chatter/core      → (nothing)
```

Every internal dependency uses the **`workspace:*`** protocol, which pnpm refuses to resolve to
anything but a local workspace package (FR-024).

**Why declare edges at all, when nothing imports anything yet?** Because a graph with zero edges
makes SC-004 and SC-005 vacuously true and leaves `tsc -b`'s ordering completely unexercised — the
build would prove nothing about dependency direction. Declaring the real architecture gives a
non-trivial build order (`core` first, then its seven dependants) and makes the conformance criteria
mean something. The alternative — declare nothing in F1 — is recorded here as the minimal option if a
reviewer prefers it.

**Read the shape of this graph precisely.** All seven non-Core members — the five non-application
libraries *and* both applications — depend on `@chatter/core` **directly and only**. They therefore
sit at the same graph level and are mutually independent. The applications are **not** downstream of
`packages/testing` or of the provider packages, and nothing in F1 makes them so. Application
dependencies on provider packages are not added speculatively; the feature that first needs one adds
it.

**Zero edges to `@chatter/testing`.** Nothing depends on it yet, which satisfies FR-021 by
construction. Applications depend on `@chatter/core` only; provider edges are added by the features
that actually need them, not speculatively.

### D5 — TypeScript configuration

`tsconfig.base.json` holds the shared compiler options. Every option whose **default changes between
TypeScript 6 and 7 is written explicitly**, which is the whole of FR-011's "mechanical migration"
requirement (research R6):

```jsonc
{
  "compilerOptions": {
    "target": "ES2024",              // explicit: TS 7 changes the default
    "lib": ["ES2024"],
    "module": "nodenext",            // explicit: TS 7 defaults to esnext; nodenext is required
    "moduleResolution": "nodenext",  //   for Node ESM resolution and the exports map
    "types": [],                     // explicit: TS 7 changes the default
    "strict": true,                  // explicit: TS 7 changes the default
    "noUncheckedSideEffectImports": true,  // explicit: TS 7 changes the default
    "stableTypeOrdering": true,      // TS 6 flag that adopts TS 7 ordering behaviour today
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true
  }
}
```

`stableTypeOrdering` is the highest-value entry: it is non-default in TS 6, mandatory and
non-disableable in TS 7, and free to adopt on an empty repository.

`rootDir` and `outDir` are **per-project, not in the base**, because relative paths in an extended
config resolve against the base file's directory and would point at the wrong place. Each member's
`tsconfig.json` therefore reads:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src/**/*"],
  "references": [ /* mirrors D4 */ ]
}
```

`rootDir` being explicit is itself an FR-011 item — TS 7 changes its default to `./`.

Additional strictness flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`) are **deliberately deferred**. They constrain code that does not exist, and
choosing them against zero real source is exactly the premature lock-in the assessment warned about.
The natural place for them is the Phase 1 feature that writes the first real Core types.

### D6 — Build graph and ordering

`tsconfig.json` at the root is a solution file — `"files": []` plus `references` to all eight members.
`pnpm run build` runs `tsc -b`, which walks the reference graph and builds in dependency order. The
delivered graph is **two levels deep, not three**:

```text
packages/core                                   ← level 0: no internal dependency
   ↓
   ├── packages/testing                         ← level 1: seven direct dependants of core,
   ├── packages/whatsapp                          mutually independent, buildable in any order
   ├── packages/slack
   ├── packages/telegram
   ├── packages/discord
   ├── apps/validation-server
   └── apps/example-client
```

The two applications are direct dependants of `@chatter/core` and are **not** downstream of the five
non-application libraries. `tsc -b` may build them before, after or interleaved with the provider
packages; only `core`-before-everything is ordered.

Each member's `references` mirror its manifest dependencies exactly (D4), so the compile graph and
the declared package graph cannot drift apart without a visible edit to both (FR-017).

**Making the ordering visible without changing the build contract.** `pnpm run build` stays exactly
`tsc -b`. When the ordering itself needs to be inspected — during the F1 evidence pass, or in a later
review — use the compiler's own reporting rather than a different build:

```bash
pnpm exec tsc -b --verbose    # prints the projects in build order and why each was or was not rebuilt
pnpm exec tsc -b --dry        # prints what a build would do, without doing it
```

These are inspection commands. They are not part of the canonical build, are not wired into
`verify`, and add no tooling.

**Consequence to be explicit about**: `tsc -b` requires every referenced project to be
`composite: true`, and `composite` forces `declaration: true`. All eight members are therefore
composite, and the two applications emit `.d.ts` as a build by-product. See Complexity Tracking.

### D7 — Entry modules

Every member's entry file contains exactly:

```ts
export {};
```

This is the smallest thing that is simultaneously a valid ES module, a compilable TypeScript project
(`tsc` errors on a project with no inputs), and a **zero-export** public surface. It emits `.js`,
`.d.ts`, `.d.ts.map` and `.js.map`, exercising the full FR-015 output contract.

It also contains no top-level await — but **absence of top-level await in the source is not evidence
that the built entry point loads.** Source text can be read without the package resolving, without
the `exports` map being correct, and without the emitted output being valid. FR-013 and SC-006 are
therefore proven by an executable post-build probe that actually loads all six library entry points
(D13 `P-LOAD`), not by reading `src/`.

A placeholder constant or marker type was rejected: FR-035 says *zero* exports, and "zero" is easier
to verify than "only harmless ones".

### D8 — Container provisioning

Appended **below** the Dockerfile's sanctioned extension line — the file's own comment designates that
region for project runtimes — bracketed by `USER root` … `USER vscode` so the image ends as it began:

1. Map `dpkg --print-architecture` to the Node artifact architecture (`amd64→x64`, `arm64→arm64`) and
   fail loudly on anything else. Both artefacts are published; the base image runs on amd64 CI
   runners and arm64 developer machines.
2. Download `node-v24.20.0-linux-<arch>.tar.xz` **and** `SHASUMS256.txt`, verify the checksum, then
   extract into `/usr/local` with `--strip-components=1`.
3. `npm install -g pnpm@11.24.0` (npm 11.19.0 ships with this Node release), then clean the npm cache.
4. Smoke-check `node --version` and `pnpm --version` at build time so a broken image fails the build
   rather than the first verification run.

Three constraints drive this shape, all established in research R3:

- **Never install into `HOME`.** `compose.yaml` mounts the `sdd-home` volume over `/sdd-home`, and a
  named volume is seeded from image content only at first creation. Anything the image writes under
  `HOME` is invisible on every pre-existing volume. `/usr/local` is immune.
- **Do not use corepack.** Node's own documentation states corepack is removed in v25+, so building
  provisioning on it guarantees a rewrite at the next runtime bump.
- **`/usr/local/bin` is on the login-shell `PATH`**, which matters because `scripts/verify.sh`
  executes commands with `bash -lc`.

`compose.yaml` is not modified. pnpm's store keeps its default location under `HOME`, which means it
persists across container recreation on the `sdd-home` volume — a free benefit, not a requirement.

### D9 — Install and lock

`pnpm install` generates `pnpm-lock.yaml`, which is committed (FR-026). Every verification-context
install uses `pnpm install --frozen-lockfile`, which fails rather than re-resolving or rewriting the
lock when manifests and lock disagree — exactly US1 acceptance scenario 4 and SC-007.

With a single devDependency (`typescript`) and seven workspace links, the lock is small and
reviewable, which is a genuine benefit of F1's zero-dependency posture.

**Lock immutability is proven by content, not by Git state.** The evidence is a SHA-256 digest of
`pnpm-lock.yaml` captured immediately before and after an install, compared for equality. This works
identically whether the lockfile is untracked, staged or committed, which matters because F1's
evidence is gathered while the file is still new. A `git status` check would report "modified" or
"untracked" for reasons unrelated to whether the install rewrote the lock, and would silently pass on
an untracked-but-rewritten file.

**"Identical resolved dependency set" is a concrete comparison, not a claim.** Two consecutive
frozen-lock installs, each from a fully removed `node_modules`, are compared on two artefacts: the
lockfile digest (unchanged by both installs) and the sorted list of entries in the virtual store
(`node_modules/.pnpm`), which is the materialised resolved set. Both must match exactly. See D13
`P-LOCK` and `quickstart.md` Scenario 2.

### D10 — Verification wiring

`.sdd/commands.env` gets **one** populated variable:

```bash
SDD_FULL_VERIFY_COMMAND="pnpm install --frozen-lockfile && pnpm run verify"
```

The other five stay empty. This is deliberate on two counts:

- `scripts/verify.sh` **short-circuits**: when `SDD_FULL_VERIFY_COMMAND` is set it runs only that and
  exits, so populating the granular variables would create configuration that never executes.
- FR-031 requires lint, format, unit-test and integration-test stages to remain unpopulated. Empty is
  the honest state, not an oversight — the implementation adds a short comment in the file saying so,
  so nobody later "fixes" the apparent gap.

The schema has no install variable, so folding the frozen-lock install into the full-verify command is
what closes the CI gap without inventing a variable or editing the workflow mechanism.

After F1, `bash scripts/dev.sh verify` performs a frozen-lock install and the root build, and exits
zero (SC-012).

### D11 — CI

**No change to `.github/workflows/quality.yml`.** It already builds the canonical image and runs
`bash scripts/dev.sh verify` inside it, so provisioning the toolchain in the image serves local and
CI execution identically — no `setup-node`, no second toolchain, no parallel CI mechanism (FR-031).

The workflow performs no separate install step and has no dependency cache; the install folded into
the full-verify command (D10) is what makes the CI run complete.

### D12 — `Docs/Tech-Stack.md`

Narrow, factual, FR-028-scoped. Replace the `Phase 0 decision` marker **only** for entries F1
materializes:

| Entry | F1 records |
|---|---|
| Language/runtime | `engines.node: ">=24.0.0"`; image pin Node `24.20.0`; TypeScript `6.0.3` |
| Package/dependency manager | pnpm `11.24.0`; pnpm workspace; `workspace:*` protocol |
| Build command | the root build command |
| Full verification command | the F1 full-verify command |
| *(new short entry)* Module format & build tooling | ESM-only; `tsc -b` with project references; no bundler |
| Lint / Typecheck / Unit test / Integration test / UI-E2E | **left as `Phase 0 decision`** |

Typecheck is deliberately **not** recorded: `tsc -b` typechecks as part of the build, and whether a
separate no-emit typecheck command exists is an F2 decision. Recording one now would claim a stage
F1 does not provide. Removing the remaining placeholders is F3's job.

### D13 — Objective verification of the graph

F1 demonstrates this evidence with one-off acceptance commands. It does **not** ship an automated
suite — that is F2's manifest meta-test work, and building one here would pull F2 into F1.

**Most of the evidence is a fail-closed assertion; a named minority is human inspection.** The `Kind`
column says which, because claiming that everything is an exit-code assertion when some items are
really reading exercises would be exactly the kind of over-claim this plan is supposed to avoid.

Probes carry **stable labels** rather than numbers, so inserting one never invalidates a
cross-reference here, in `data-model.md` or in the contract. Full runnable form of every probe, and a
requirement-to-probe coverage map, are in `quickstart.md`.

| Probe | Kind | Scenario | How | Satisfies |
|---|---|---|---|---|
| `P-TOOLCHAIN` | assertion | 1 | assert `node --version`, `pnpm --version` and `tsc --version` equal the exact pins, in a **login** shell — the shell `scripts/verify.sh` actually uses | FR-027 |
| `P-LOCK` | assertion | 2 | SHA-256 of `pnpm-lock.yaml` asserted equal before/after each of two clean installs; sorted `node_modules/.pnpm` entry lists `diff`ed between them, with a non-empty guard so the comparison cannot be vacuous | FR-026, SC-007 |
| `P-DIVERGE` | assertion (mutating) | 3 | under a `trap`, add a dependency the lock does not know; capture the **raw** `--frozen-lockfile` status, print it as RED evidence, assert it is non-zero, assert the lock digest is unchanged, restore, assert byte-identical restoration, then assert a clean GREEN install | SC-007 |
| `P-MEMBERS` | assertion | 4 | assert the raw project count is **9** and that exactly one project at the workspace root is named `chatter`; drop that entry and `diff` the remaining sorted **name** set — and separately the sorted repo-relative **path** set — against checked expected lists; assert `bruno/` holds only `.gitkeep` | FR-001, FR-006, SC-002 |
| `P-MANIFESTS` | assertion | 5 | data-driven loops asserting, per library: name, version exactly `0.0.0` (D3 and contract C2.1 fix it, since nothing is released), `type: module`, `engines.node`, an `exports` map with exactly the `.` subpath and `types` declared **before** `default`, and the absence of `main`/`module`/`browser`/`publishConfig`/`private` and of publish scripts. Per application: name, `private: true`, `type: module`, `engines.node`, **absence** of `exports`, and the documented version rule (absent, or exactly the `0.0.0` fallback). For the root: `name`, `private`, `type`, `engines.node`, `packageManager`, an **exact** `typescript` devDependency with no range prefix, exactly one devDependency, zero production dependencies, and the script set being exactly `build,clean,verify` with their exact bodies | FR-002 – FR-005, FR-007, FR-012, FR-016, FR-032, FR-034 |
| `P-BUILD` | assertion | 6 | `pnpm run clean && pnpm run build`, then assert each of the six libraries emitted `.js`, `.js.map`, `.d.ts` and `.d.ts.map`, and each application emitted its entry | FR-014, FR-015, SC-003 |
| `P-ORDER` | **inspection** | 6 | `pnpm exec tsc -b --verbose`, read by a human. Parsing compiler progress output into an assertion would be brittle, and a wrong reference graph already fails `P-EDGES`. The canonical build is unchanged | FR-017 |
| `P-LOAD` | assertion | 7 | post-build, for each of the six libraries: `node --input-type=commonjs -e "require('<name>')"` executed with that package as the working directory, so it resolves **through the delivered `exports` map by package name**; collect every failure, then fail the probe if the collected list is non-empty | FR-013, SC-006 |
| `P-EDGES` | assertion | 8 | derive the internal edge set from all eight manifests **and** from all eight `references` arrays, normalise both to `<member> -> <member>` form, and `diff` each against one checked expected list of seven edges; assert every internal dependency **value** is exactly `workspace:*`; assert no external production dependency and no dev/peer/optional dependency on any member | FR-017, FR-019 – FR-024, SC-004, SC-005 |
| `P-UNDECLARED` | assertion (mutating) | 9 | under a `trap`, replace `packages/slack/src/index.ts` with an import of `@chatter/telegram` — an edge `slack` does not declare — capture the **raw** build status, print it as RED evidence, assert it is non-zero, restore, assert byte-identical restoration, then assert a clean GREEN install and build | FR-025, SC-005 |
| `P-BASELINE` | assertion | 10 | a no-dependency `node -e` that **throws** unless `new Error('x', { cause: 1 }).cause` is set and `typeof ReadableStream === 'function'` | FR-009, SC-008 |
| `P-ZERO` | assertion + **inspection** | 11 | *assertion*: `cmp` each of the eight entry modules against a canonical `export {};` file (byte-identical, trailing newline included), assert the count is 8, assert none of the **nine enumerated project manifests** declares `publishConfig` or a publish script, and sweep tracked *and* untracked files with `git ls-files --cached --others --exclude-standard` for release-automation artefacts. *Inspection*: reading the six emitted `.d.ts` — not the primary evidence, since `P-LOAD` asserts zero own keys at runtime | FR-035, SC-009, SC-010 |
| `P-VERIFY` | assertion | 12 | assert `SDD_FULL_VERIFY_COMMAND` equals exactly `pnpm install --frozen-lockfile && pnpm run verify`, the five granular variables are empty, and the root `verify` script is exactly `pnpm run build`; record the lock digest and **delete every `node_modules` and every `dist`**; run `bash scripts/dev.sh verify`; then assert the virtual store exists, the lock digest is unchanged, and all eight members were built | FR-029 – FR-031, SC-001, SC-011, SC-012 |
| `P-TECHSTACK` | assertion + **inspection** | 13 | *assertion*: `Docs/Tech-Stack.md` records the exact Node, pnpm and TypeScript pins, ESM-only, `tsc -b` and project references, **and still contains `Phase 0 decision` placeholders** so F1 has not performed F3's rewrite. *Inspection*: reading the diff to confirm the update is narrow | FR-028 (recording), SC-013 |
| `P-WORKFLOW` | assertion | 14 | `bash scripts/dev.sh check` exits 0 | Adoption Checklist wiring |
| `P-CI` | assertion | 15 | assert `git diff --stat main -- .github/` is empty **and** `git status --porcelain --untracked-files=all -- .github/` is empty, so committed, staged, modified and untracked workflow files are all caught | FR-031, SC-010 |

Three requirements have **no** assertion and are honestly labelled inspection in `quickstart.md`'s
coverage map: **FR-011** (the TypeScript-6-to-7 default audit — a compiler-default comparison is not
usefully assertable before TS 7 is adopted; read `tsconfig.base.json` against D5), **FR-018**
(`.gitignore` review), and **FR-033** (a recorded pre-publication requirement with nothing to
execute).

**How the assertions are made fail-closed.** Every probe is delivered to the container as a
self-contained script with its own `set -euo pipefail`, never pasted into an interactive shell — an
interactive container shell does not provide `errexit`, so a block that assumed it would run on past
a failed check and still exit 0. Every mandatory comparison carries an explicit failure path
(`… || fail "…"`); a bare `[ … ] && echo ok` is not an assertion, because when false it prints
nothing, continues, and leaves the block's status to whatever ran last. The two mutating probes
(`P-DIVERGE`, `P-UNDECLARED`) capture the tested command's raw status with `set +e`/`set -e` rather
than `; echo "exit=$?"` — which would report the `echo`'s status, not the command's — and they
install `trap … EXIT INT TERM` **before** mutating, so the file is restored on success, on assertion
failure and on interruption alike.

**On `P-MEMBERS`.** pnpm's recursive `list` operates on *every* workspace project **including the
workspace root**; the root-exclusion behaviour that applies to `exec`, `run`, `test` and `add` does
**not** apply to `list`. Raw output therefore contains nine entries, not eight, and a bare count is
the wrong check. The root is discriminated by `path`, not by position or by name, so the filter stays
correct even if the root manifest is renamed. This is recorded so a later reader does not "simplify"
the filter away.

**On `P-LOAD`.** This is the executable proof that SC-006 asks for, and it is deliberately stronger
than reading `src/` for `await`:

- it runs **after the build**, against the emitted `dist/` output, so a package that compiles but
  emits something unloadable fails;
- it resolves **by package name** (`require('@chatter/core')`) rather than by file path, using Node's
  self-reference resolution, which requires the package's own `exports` map to be present and
  correct — so it exercises the delivered entry-point configuration from C2.2;
- it uses **`require()` of an ES module**, which Node supports unflagged on the pinned Node 24
  baseline and which **throws `ERR_REQUIRE_ASYNC_MODULE` if the entry graph needs asynchronous
  evaluation**. That failure mode is precisely FR-013's constraint, so the probe cannot pass a graph
  that has acquired top-level await.

Scope note: `P-LOAD` tests **Chatter's own entry graphs** for synchronous loadability. Per FR-013 it
is not, and must not be presented as, a promise of universal legacy CommonJS compatibility.
Applications are excluded — they declare no `exports` map and are not consumable packages.

**On `P-VERIFY`.** Deleting every `node_modules` *and* every `dist` before invoking
`bash scripts/dev.sh verify` is what turns SC-012 into a proof rather than a re-run over a warm tree.
The post-run assertions then fail if installation was skipped, if the lock was not treated as frozen,
or if the build was bypassed — the three ways the verification surface could appear green while
proving nothing.

**On `P-ZERO`.** Three scoping choices are deliberate. The entry-module comparison uses `cmp` against
a canonical file, so "byte-identical" is literally true including the trailing newline, rather than a
command-substitution comparison that silently strips trailing whitespace. The manifest inspection
enumerates exactly the nine project manifests instead of scanning recursively, so it can never report
a finding from an installed dependency. And SC-010 does not rest on three strings in `package.json`:
`git ls-files --cached --others --exclude-standard` sweeps tracked and untracked files for the
artefacts a release tool would introduce, honouring `.gitignore` so `node_modules/` is excluded by
construction, while a release *workflow* is caught by `P-CI`.

`P-BASELINE` uses no dependency and no `@types/node`, which is why F1 can stay at a single
devDependency. `@types/node` belongs to the first feature that writes code touching Node APIs.

None of these probes is wired into `pnpm run verify` or `.sdd/commands.env`. They are acceptance
evidence recorded during F1 implementation; turning them into a checked-in automated suite is F2's
work, and doing it here would pull a test layer into F1.
---

## Implementation Order

Ordered so that each step is independently observable, and so that the first failure is the cheapest
one to diagnose. This is the sequencing input for `/speckit-tasks`; it is not a task list.

1. **Container** — extend the Dockerfile (D8); rebuild; confirm `node -v` → `v24.20.0` and
   `pnpm -v` → `11.24.0` **in a login shell** (`bash -lc`), which is what verification uses.
2. **Root workspace** — `package.json` (D2), `pnpm-workspace.yaml` (D1); add `*.tsbuildinfo` to
   `.gitignore`.
3. **TypeScript baseline** — `tsconfig.base.json` (D5) and the root solution `tsconfig.json` (D6),
   initially referencing nothing.
4. **`packages/core`** — manifest, tsconfig, `src/index.ts`; add to the solution; build it alone.
   This is the first proof the whole toolchain works, on the one member with no dependencies.
5. **The five remaining libraries** — `testing`, `whatsapp`, `slack`, `telegram`, `discord`, each with
   its `@chatter/core` dependency and matching project reference (D4).
6. **The two applications** — manifests without `exports`, marked private (D3).
7. **`bruno/.gitkeep`** — the frozen layout's reserved directory, with no collection content (FR-006).
8. **Install and lock** — `pnpm install` inside the container; commit `pnpm-lock.yaml` (D9).
9. **Root build** — `pnpm run build`; confirm all eight compile and all six libraries emit `.js`,
   `.d.ts`, `.d.ts.map` and `.js.map`.
10. **Verification wiring** — populate `SDD_FULL_VERIFY_COMMAND` (D10); run
    `bash scripts/dev.sh verify` and observe exit 0.
11. **`Docs/Tech-Stack.md`** — the narrow factual update (D12). **This must precede the evidence
    pass**: `P-TECHSTACK` asserts against this file, so it cannot pass until the update exists.
12. **Evidence pass** — run the complete D13 probe set: `P-TOOLCHAIN`, `P-LOCK`, `P-DIVERGE`,
    `P-MEMBERS`, `P-MANIFESTS`, `P-BUILD`, `P-ORDER`, `P-LOAD`, `P-EDGES`, `P-UNDECLARED`,
    `P-BASELINE`, `P-ZERO`, `P-VERIFY`, `P-TECHSTACK`, `P-WORKFLOW`, `P-CI`.

    Prerequisites are stated by label, not by position, so reordering the steps above cannot
    invalidate them:

    - `P-BUILD`, `P-ORDER`, `P-LOAD`, and the emitted-`.d.ts` half of `P-ZERO`, require a completed
      build. `P-LOAD` depends on `P-BUILD` specifically, because it loads emitted `dist/` output.
    - `P-TECHSTACK` requires the `Docs/Tech-Stack.md` update from step 11.
    - `P-VERIFY` deliberately deletes every `node_modules` and every `dist` before invoking the
      canonical entry point, so run it **after** the other build-dependent probes — or re-run
      `pnpm run build` afterwards if a later probe needs build output.
    - Every remaining probe is order-independent.

    `P-UNDECLARED` is recorded as observed-failure → restore → observed-pass.
13. **TDD evidence** — record the `skip` rationale for behavioural RED and attach the `P-UNDECLARED`
    observation, per AGENTS.md.

Steps 1–3 must be sequential. **Steps 5 and 6 are mutually independent of each other and internally**
— all seven members created there depend only on `packages/core` from step 4, so they may be done in
any order; the applications are not blocked on the libraries. Steps 8–10 are sequential. Step 11 can
happen any time after step 1 fixes the versions, but must precede step 12.

---

## Requirement Coverage

### Functional requirements

| FR | Covered by |
|---|---|
| FR-001 | D1 — `packages/*` + `apps/*` globs resolve to exactly the eight frozen members; `bruno/` excluded |
| FR-002 | D3 — every member gets a real manifest; D7 gives each a compilable source file |
| FR-003 | D3 — `@chatter/<name>` for all six libraries; asserted by D13 `P-MANIFESTS` |
| FR-004 | D3 — both applications carry an identity and `private: true`; asserted by D13 `P-MANIFESTS` |
| FR-005 | D3 — each library carries its own `version`; asserted by D13 `P-MANIFESTS` |
| FR-006 | D1 (not a member) + step 7 — `bruno/.gitkeep`, no collections |
| FR-007 | D2, D3 — `engines.node: ">=24.0.0"` at root and in all eight manifests; asserted by D13 `P-MANIFESTS` |
| FR-008 | Research R1 — Node `24.20.0` pinned in the image (D8); CI uses the same image (D11) |
| FR-009 | D13 — runtime capability probe, no dependency required |
| FR-010 | Research R5 — `typescript: "6.0.3"`, exact, root devDependency (D2) |
| FR-011 | D5 + research R6 — every TS 6→7 default written explicitly, plus `stableTypeOrdering: true` |
| FR-012 | D2, D3 — `"type": "module"` everywhere; no CJS output, no dual build; asserted by D13 `P-MANIFESTS` |
| FR-013 | D7 — `export {};` entry graphs carry no top-level await; **proven** by D13 `P-LOAD`, whose `require()` of each built ESM entry throws `ERR_REQUIRE_ASYNC_MODULE` if asynchronous evaluation is ever introduced |
| FR-014 | D6 — one `tsc -b` over a solution referencing all eight members |
| FR-015 | D5, D6 — `declaration`, `declarationMap`, `sourceMap` for all six libraries; applications build without a library-declaration requirement (see Complexity Tracking) |
| FR-016 | D2 — the only devDependency is `typescript`; no bundler exists to invoke. D13 `P-MANIFESTS` asserts the exact root script set (`build,clean,verify`, `build` being literally `tsc -b`) and exactly one devDependency, so a bundler could not be added without failing |
| FR-017 | D6 — `references` mirror manifest dependencies; a new edge needs two visible edits |
| FR-018 | D6 — `node_modules/`, `dist/` and `coverage/` are already ignored; `*.tsbuildinfo` is added. **[inspection]** — no probe asserts this; a stray build artefact under `.github/` would additionally be caught by `P-CI` |
| FR-019 | D4 — providers → core only; `@chatter/core` declares nothing and references nothing |
| FR-020 | D4 — no provider-to-provider edge is declared; D13 `P-UNDECLARED` shows one cannot resolve |
| FR-021 | D4 — zero edges to `@chatter/testing` from any member |
| FR-022 | D3, D4 — applications depend on `@chatter/core` only, are private, have no provider SDK |
| FR-023 | D3, D7 — `apps/example-client` is an empty module with no dependency but core; no SDK exists |
| FR-024 | D4 — `workspace:*` protocol throughout; D13 `P-EDGES` asserts every internal dependency **value** is exactly `workspace:*`, so a registry range, `file:` path or `link:` protocol fails |
| FR-025 | D1 — `nodeLinker: isolated` stated explicitly; demonstrated by D13 `P-UNDECLARED` |
| FR-026 | D9 — `pnpm-lock.yaml` committed; `--frozen-lockfile` in verification; `pmOnFail: error` |
| FR-027 | D8 — Node and pnpm at exact pinned versions in the image; research R2 fixes pnpm `11.24.0` |
| FR-028 | D8 (below the sanctioned line, no parallel environment, no `compose.yaml` change) + D12 (narrow Tech-Stack recording, asserted by D13 `P-TECHSTACK`); the Dockerfile extension point itself is inspection |
| FR-029 | D13 `P-VERIFY` — install and build succeed inside the canonical container from a cold checkout; every probe executes through `scripts/dev.sh`, and D11 confirms CI runs the same surface in the same image |
| FR-030 | D2 — `build`, `clean`, `verify` scripts, discoverable from the root manifest; asserted by D13 `P-MANIFESTS` and `P-VERIFY` |
| FR-031 | D10 — full-verify only, covering frozen-lock install + root build; five variables left empty; D11 — no CI change. D13 `P-VERIFY` asserts the exact full-verify string and the five empty variables; `P-CI` asserts no committed, staged, modified or untracked change under `.github/` |
| FR-032 | D3 — naming convention only; no `publishConfig`, no registry assertion anywhere; asserted by D13 `P-MANIFESTS` and `P-ZERO` |
| FR-033 | Recorded as a pre-publication requirement in the assessment and restated in D3's exclusions |
| FR-034 | D2, D3 — no publish script, no release tooling, no changesets; asserted by D13 `P-MANIFESTS` (no publish scripts across the nine manifests) and `P-ZERO` (release-automation artefact sweep) |
| FR-035 | D7 — `export {};`; providers declare no SDK; applications contain no routes, UI or logic |

### Success criteria

| SC | Demonstrated by |
|---|---|
| SC-001 | D13 `P-VERIFY` — install and full build completed from a cold checkout through the documented entry point, with no undocumented step |
| SC-002 | D13 `P-MEMBERS` — root-filtered `pnpm list --recursive --depth -1 --json`, sorted member-name **and** member-path sets `diff`ed against the expected eight |
| SC-003 | D13 `P-BUILD` — one root command, zero errors, four artefact types asserted present for each of the six libraries, and both applications built |
| SC-004 | D13 `P-EDGES` — the derived edge set from manifests **and** project references, each `diff`ed against one checked expected list of seven edges; any forbidden edge appears as a line the expected set does not contain |
| SC-005 | D4 (explicit edges, zero forbidden) + D13 `P-EDGES` (dual-declaration exact-set match, plus the `workspace:*` value check) + D13 `P-UNDECLARED` (undeclared import: RED → restore → GREEN, with the raw failing status asserted non-zero) |
| SC-006 | D13 `P-LOAD` — a post-build `require()` of all six library entry points by package name, run under the pinned Node 24.20.0; fails if any entry cannot be loaded synchronously |
| SC-007 | D9 + D13 `P-LOCK` (lockfile SHA-256 unchanged across two clean installs; identical virtual-store entry set between them) and `P-DIVERGE` (a deliberate manifest/lock divergence rejected, then restored byte-identically with the lock untouched) |
| SC-008 | D13 — baseline capability probe |
| SC-009 | D13 `P-ZERO` — byte-identical `cmp` of the eight entry modules against the canonical file, plus inspection of the six emitted `.d.ts`, plus `P-LOAD`'s runtime assertion that each loaded namespace has zero own keys |
| SC-010 | D13 `P-ZERO` — no `publishConfig` or publish script across the nine enumerated manifests, and a tracked-plus-untracked sweep finds no release-automation artefact — together with `P-CI`, which catches release automation arriving as a workflow file under `.github/` |
| SC-011 | Every probe executes via `scripts/dev.sh`; `P-VERIFY` is the end-to-end case. Host results are not counted |
| SC-012 | D13 `P-VERIFY` — `bash scripts/dev.sh verify` exits 0 **from a state with no `node_modules` and no `dist`**, then the virtual store, the unchanged lock digest and all eight built members are asserted, so a skipped install, an unfrozen lock or a bypassed build all fail |
| SC-013 | D13 `P-TECHSTACK` — the exact Node, pnpm and TypeScript pins, ESM-only, `tsc -b` and project references are asserted present, and remaining `Phase 0 decision` placeholders are asserted still present so F1 has not done F3's rewrite |

---

## Risks and Fallbacks

| # | Risk | Class | Response |
|---|---|---|---|
| R-1 | Strict isolated `node_modules` on the Windows bind mount is slow or breaks symlinks | **Implementation-time validation** | Ordered fallbacks (research R11): **first** relocate `node_modules` to container-local storage — preserves FR-025, needs a `compose.yaml` change, so it is a deliberate recorded decision; **only as a last resort** `nodeLinker: hoisted`, which **breaks FR-025** and therefore requires explicit human approval and a recorded substitution, never an implementer's judgement call. Timebox the debugging; escalate rather than expand. |
| R-2 | pnpm requires a `version` field on the private application manifests | Non-blocking | Fall back to `"0.0.0"` (D3). Satisfies the tool, asserts no versioning intent. |
| R-3 | `pmOnFail` default is documented inconsistently upstream (`ignore` vs `download`) | Non-blocking | F1 sets the value explicitly (`error`), so the default is irrelevant (research R2/R4). |
| R-4 | `target: "ES2024"` is a judgement about what Node 24 fully supports | Non-blocking | Confirm at implementation time; a downward adjustment to `ES2023` is a one-line change with no architectural consequence. |
| R-5 | Node 24 enters maintenance on 2026-10-20, seven weeks out | Non-blocking | Expected and scheduled. A patch bump inside the ratified major line is routine and needs no substitution. Adding Node 26 to CI remains a later decision. |
| R-6 | TS 6 is patched infrequently now that 7.x is current (last stable 2026-04-16) | Non-blocking | Accepted knowingly; the TS 7 migration is already tracked and D5 makes it mechanical. |
| R-7 | Image build needs network access to nodejs.org and the npm registry | Non-blocking | Already true of the existing image (it installs `gh` and `specify-cli`). Checksum verification makes the Node fetch auditable. |
| R-8 | A reviewer reads application `.d.ts` emit as violating FR-015 | Non-blocking | Documented in Complexity Tracking with the alternative design and its cost. |

**No blocking risk.** Nothing in this list prevents implementation from starting.

---

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected because |
|---|---|---|
| All eight members are `composite: true`, so the two applications emit `.d.ts` even though FR-015 says applications "MUST NOT be **required** to emit library declarations" | `tsc -b` requires every referenced project to be composite, and `composite` forces `declaration: true`. FR-014 requires **one** root command covering all eight members, so all eight must be referenced. The emitted application declarations are ignored build state — the applications are `private`, expose no `exports` map, publish nothing, and no consumer reads them; they sit in ignored output directories alongside `.tsbuildinfo`. No consumability requirement is imposed on them. | Referencing only the six libraries from the solution and building each application with its own `tsc -p` invocation keeps the applications non-composite and honours FR-015 literally — but it splits FR-014's single root command into three, loses cross-project incremental ordering for the applications, and buys a cosmetic property with a real capability. If the reviewer prefers the literal reading, this is a one-line change to the root script and the solution file. |
| A `verify` root script that currently just calls `build` | Gives F2 a seam to add lint/typecheck/tests without editing `.sdd/commands.env` or `scripts/verify.sh`, and keeps the verification surface honest in the meantime | Pointing `SDD_FULL_VERIFY_COMMAND` straight at `tsc -b` is marginally simpler but forces F2 to edit the workflow configuration file rather than a project script, and blurs which layer owns the verification pipeline. |
| Declaring seven dependency edges that nothing imports yet | Without them the build graph is flat, `tsc -b` ordering is never exercised, and SC-004/SC-005 are vacuously true | Declaring no edges is simpler but makes the feature's central conformance criteria meaningless and defers all graph risk to the first feature that adds a real import. |

Everything else in this plan is the minimum required by the approved specification.
