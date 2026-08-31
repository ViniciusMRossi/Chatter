---

description: "Task list for F1 Repository / Workspace Foundation"
---

# Tasks: Repository / Workspace Foundation

**Input**: Design documents from `/specs/001-repository-workspace-foundation/`

**Prerequisites**: `spec.md` (approved 2026-08-31), `plan.md` (approved 2026-08-31), `research.md`,
`data-model.md`, `contracts/workspace-member.contract.md`, `quickstart.md`

**Tests**: **No test tasks are generated.** F1 introduces no test runner and no behaviour — the
approved spec assigns the contract-first harness and all lint/format/test tooling to F2. F1's
objective evidence is the fail-closed probe set defined in `plan.md` D13 and made runnable in
`quickstart.md`. See *TDD evidence* (T039).

**Organization**: Tasks are grouped by user story. The linear sequence in `plan.md` →
*Implementation Order* is preserved and mapped onto the phases below (see *Plan-order mapping*).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — audited against **filesystem *and* workspace-state** effects, not
  merely against which files a description names. See *[P] audit*.
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Execution gate (before any task below)

**Implementation MUST NOT begin until a human has approved this task list.** `Docs/Workflow.md`
places human approval before implementation, and `AGENTS.md` keeps the merge gate human-controlled.
`/speckit-implement` is not authorised by plan approval alone.

## Container-first execution (AGENTS.md)

Every build, install, workflow script and Git operation runs **inside the canonical development
container**. Use `bash scripts/dev.sh exec …` for commands sharing the long-running environment, and
`bash scripts/dev.sh verify` / `check` for the canonical wrappers. Results obtained on the host are
not evidence (SC-011). Host-only activity is limited to Docker runtime/bootstrap and editor UI.

## Path conventions

Repository-root monorepo, per `plan.md` → *Project Structure*: `packages/{core,testing,whatsapp,
slack,telegram,discord}`, `apps/{validation-server,example-client}`, `bruno/`. Build output is
per-member `dist/`.

## Toolchain-availability note (prerequisite clarification, not a plan change)

`plan.md` D2 makes `typescript@6.0.3` the **root devDependency**, and `plan.md` step 4 requires
`packages/core` to be compiled alone before the other seven members exist. Those two facts together
mean the local pinned compiler must be installed before `pnpm exec tsc` can resolve — a global
TypeScript, `pnpm dlx`, or any unpinned download is forbidden by the approved stack.

This list therefore separates two installs, which `plan.md` does not conflate and does not forbid:

- **T008 preliminary install** — materialises the pinned root devDependency so `pnpm exec tsc`
  resolves. Its lockfile is **provisional working state and is NOT the committed artifact**.
- **T019 final lock generation** — `plan.md` step 8 / D9. Re-run with all eight members present, so
  the committed `pnpm-lock.yaml` reflects the complete workspace (FR-026).

Nothing in `plan.md` step 4, step 8 or D9 forbids an earlier install; step 8 is where the **committed**
lock is produced, which is precisely why it follows every manifest. No plan change is required or made.

## Plan-order mapping

| `plan.md` Implementation Order step | Tasks |
|---|---|
| 1 Container | T001–T002 |
| 2 Root workspace | T003–T005 |
| 3 TypeScript baseline | T006–T007 |
| *(prerequisite clarification — preliminary install)* | T008 |
| 4 `packages/core` | T009 |
| 5 Five remaining libraries | T010–T014 |
| 6 Two applications | T015–T016 |
| 7 `bruno/.gitkeep` | T017 |
| 8 Install and lock | T018–T019 |
| 9 Root build | T020 |
| 10 Verification wiring — populate `SDD_FULL_VERIFY_COMMAND` **and** run `bash scripts/dev.sh verify` to exit 0 | T021 (both halves) |
| 11 `Docs/Tech-Stack.md` (**must precede the evidence pass**) | T022 |
| 12 Evidence pass (all 16 `P-*` probes) | T023–T038 |
| 13 TDD evidence | T039 |

---

## Definition of done: library member (L1–L11)

Every task creating a package under `packages/` MUST satisfy all of the following, from `plan.md`
D3/D4/D7 and contract C1/C2. Each library task below names its own specific values and requires
conformance to this block.

- **L1** `name` is exactly `@chatter/<dirname>`.
- **L2** `version` is exactly `"0.0.0"` — nothing is released, and the value is asserted exactly.
- **L3** `type` is exactly `"module"` (ESM-only, FR-012).
- **L4** `engines.node` is exactly `">=24.0.0"` (FR-007).
- **L5** `exports` declares exactly the `.` subpath, with `types` **before** `default` (order is
  significant), targeting `./dist/index.d.ts` and `./dist/index.js` respectively.
- **L6** The manifest declares **none** of `main`, `module`, `browser`, `publishConfig`, `private`,
  and **no** `prepublishOnly` / `prepack` / `publish` / `release` script (FR-032, FR-034).
- **L7** The manifest declares no `devDependencies`, `peerDependencies` or `optionalDependencies`,
  and **no provider SDK** in any dependency field.
- **L8** The internal dependency edge is declared as `"@chatter/core": "workspace:*"` — exactly the
  workspace protocol, never a registry range, `file:` path or `link:` protocol (FR-024).
  `packages/core` declares **no** internal dependency.
- **L9** `tsconfig.json` extends `../../tsconfig.base.json` and sets `rootDir: "./src"` and
  `outDir: "./dist"` locally (relative paths in an extended config resolve against the base file's
  directory, so these cannot live in the base).
- **L10** `tsconfig.json` `references` mirror the manifest edge exactly — `[{ "path": "../core" }]`,
  and `[]` for `packages/core` itself (dual declaration, contract C4.1).
- **L11** `src/index.ts` content is exactly `export {};` followed by a single trailing newline —
  byte-defined per contract C1.3 so it can be verified with `cmp`. **No** import, export of any
  value/type/class/function, side effect, top-level await, provider SDK or Chatter behaviour.

## Definition of done: application member (A1–A10)

Every task creating an application under `apps/` MUST satisfy all of the following, from contract C3
and `plan.md` D3.

- **A1** `name` is exactly `chatter-<dirname>` — unscoped, because using `@chatter/*` for something
  that will never be published would misrepresent the naming convention.
- **A2** `private` is `true` (FR-004).
- **A3** `type` is exactly `"module"`.
- **A4** `engines.node` is exactly `">=24.0.0"`.
- **A5** The manifest declares **no** `exports` map and **no** `publishConfig` (C3.2).
- **A6** `version` is **absent**. `"0.0.0"` is permitted **only** as the documented fallback if the
  toolchain turns out to require a version on a private member; it asserts no versioning intent.
- **A7** The only dependency is `"@chatter/core": "workspace:*"` — no provider package, **no provider
  SDK**, no external dependency, and no dev/peer/optional dependencies (FR-022, FR-023).
- **A8** `tsconfig.json` extends `../../tsconfig.base.json`, sets `rootDir: "./src"` and
  `outDir: "./dist"`, and its `references` are exactly `[{ "path": "../../packages/core" }]`.
- **A9** `src/main.ts` content is exactly `export {};` followed by a single trailing newline.
- **A10** The application contains **no** routes, UI, transport, persistence, business logic,
  provider integration or product behaviour of any kind (FR-035).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Provision the toolchain and declare the workspace.

- [x] T001 Extend `.devcontainer/Dockerfile` **below the sanctioned extension line** with Node.js `24.20.0` (architecture-selected tarball verified against `SHASUMS256.txt`, extracted to `/usr/local`) and pnpm `11.24.0` via `npm install -g`, bracketed `USER root` … `USER vscode`, per `plan.md` D8. Do **not** modify `compose.yaml`, do **not** use corepack, and do **not** install anything under `HOME`.
- [x] T002 Rebuild the image and run the **early container smoke check** of `plan.md` step 1: `bash scripts/dev.sh up`, then `bash scripts/dev.sh exec bash -lc 'node --version; pnpm --version'` asserting exactly `v24.20.0` and `11.24.0` **in a login shell** (the shell `scripts/verify.sh` uses). **Do not run `P-TOOLCHAIN` here** — its TypeScript assertion needs the root devDependency, which is not installed until T008; `P-TOOLCHAIN` is T023.
- [x] T003 Create root `package.json` per `plan.md` D2: `name: "chatter"`, `private: true`, `type: "module"`, `engines.node: ">=24.0.0"`, `packageManager: "pnpm@11.24.0"`, the single devDependency `typescript: "6.0.3"` (exact, no range prefix), and exactly the scripts `build` (`tsc -b`), `clean` (`tsc -b --clean`), `verify` (`pnpm run build`).
- [x] T004 [P] Create `pnpm-workspace.yaml` per `plan.md` D1: members `packages/*` and `apps/*`, plus **six** settings — `pmOnFail: error`, `engineStrict: true`, `nodeLinker: isolated`, and the supply-chain policy `blockExoticSubdeps: true`, `minimumReleaseAge: 10080`, `trustPolicy: no-downgrade`, with **no** exception key. *(The three supply-chain values were adopted after PR #1 as a Tier 1 Semgrep correction, not during initial planning; `P-MANIFESTS` asserts all six by exact value.)* Create **no `.npmrc`** — pnpm 11 reads settings from `pnpm-workspace.yaml` and would silently ignore an `.npmrc` (research R2).
- [x] T005 [P] Add `*.tsbuildinfo` to `.gitignore` (FR-018); confirm `node_modules/`, `dist/` and `coverage/` are already covered.
- [x] T006 Create `tsconfig.base.json` per `plan.md` D5 with every TypeScript 6→7 default written explicitly — `target`, `lib`, `module`/`moduleResolution` (`nodenext`, deliberately not TS 7's `esnext` default), `types`, `strict`, `noUncheckedSideEffectImports`, `stableTypeOrdering` — plus `composite`, `declaration`, `declarationMap`, `sourceMap`, `verbatimModuleSyntax`, `isolatedModules`. Do **not** put `rootDir`/`outDir` here.
- [x] T007 Create the root solution `tsconfig.json` per `plan.md` D6 with `"files": []` and an empty `references` array, to be populated in T018.
- [x] T008 **Preliminary install** — run `bash scripts/dev.sh exec bash -lc 'pnpm install'` so the exactly pinned root devDependency `typescript@6.0.3` is materialised into `node_modules` and `pnpm exec tsc` resolves locally. Confirm with `bash scripts/dev.sh exec bash -lc 'pnpm exec tsc --version'` → `Version 6.0.3`. `packages/*` and `apps/*` match nothing yet, so a "no projects matched" notice is expected. **The `pnpm-lock.yaml` produced here is provisional working state and MUST NOT be treated as the committed artifact** — T019 regenerates it once all eight members exist. Do **not** substitute a global TypeScript, `pnpm dlx`, or any unpinned download.

**Checkpoint**: the container provides the pinned toolchain, the workspace is declared, and the local compiler resolves. No member exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Materialise the frozen layout as real, resolvable members and produce the **committed**
lockfile. **All three user stories verify artifacts created here**, which is why this phase is
foundational rather than part of any one story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Create `packages/core/{package.json,tsconfig.json,src/index.ts}` satisfying **L1–L11** with: name `@chatter/core`; **no** internal dependency (L8) and **no** project reference (L10, `references: []`). Then compile it alone — `bash scripts/dev.sh exec bash -lc 'pnpm exec tsc -b packages/core'` — using the local pinned compiler installed in T008, and confirm `packages/core/dist/{index.js,index.js.map,index.d.ts,index.d.ts.map}` are emitted. This is the first proof the toolchain works, on the one member with no dependencies (`plan.md` step 4).
- [x] T010 [P] Create `packages/testing/{package.json,tsconfig.json,src/index.ts}` satisfying **L1–L11** with: name `@chatter/testing`; dependency `"@chatter/core": "workspace:*"`; reference `../core`. `@chatter/testing` is dev/test infrastructure and MUST NOT become a production dependency of anything (FR-021).
- [x] T011 [P] Create `packages/whatsapp/{package.json,tsconfig.json,src/index.ts}` satisfying **L1–L11** with: name `@chatter/whatsapp`; dependency `"@chatter/core": "workspace:*"`; reference `../core`. **No `meta-cloud-api` or any provider SDK, and no adapter behaviour** — provider work is governed by constitution Principle III and belongs to Phase 8+.
- [x] T012 [P] Create `packages/slack/{package.json,tsconfig.json,src/index.ts}` satisfying **L1–L11** with: name `@chatter/slack`; dependency `"@chatter/core": "workspace:*"`; reference `../core`. **No `@slack/*` or any provider SDK, and no adapter behaviour.**
- [x] T013 [P] Create `packages/telegram/{package.json,tsconfig.json,src/index.ts}` satisfying **L1–L11** with: name `@chatter/telegram`; dependency `"@chatter/core": "workspace:*"`; reference `../core`. **No `grammy` or any provider SDK, and no adapter behaviour.**
- [x] T014 [P] Create `packages/discord/{package.json,tsconfig.json,src/index.ts}` satisfying **L1–L11** with: name `@chatter/discord`; dependency `"@chatter/core": "workspace:*"`; reference `../core`. **No `discord.js` or any provider SDK, and no adapter behaviour.**
- [x] T015 [P] Create `apps/validation-server/{package.json,tsconfig.json,src/main.ts}` satisfying **A1–A10** with: name `chatter-validation-server`. It consumes Chatter as an external application and MUST NOT bypass it or import a provider SDK directly.
- [x] T016 [P] Create `apps/example-client/{package.json,tsconfig.json,src/main.ts}` satisfying **A1–A10** with: name `chatter-example-client`. No browser transport, no bundler, and **no provider credentials or SDK reachable from browser code** (constitution Principle XII).
- [x] T017 [P] Create `bruno/.gitkeep` so the frozen layout's reserved acceptance directory exists with no collections (FR-006). The explanatory README belongs to F3.
- [x] T018 Populate `references` in the root solution `tsconfig.json` with all eight members. **Shared file — not parallel-safe with T009–T017.**
- [x] T019 **Final lock generation** (`plan.md` step 8 / D9) — re-run `bash scripts/dev.sh exec bash -lc 'pnpm install'` now that all eight members exist, so the regenerated `pnpm-lock.yaml` reflects the complete workspace. **This regenerated lockfile is the committed artifact** (FR-026); the provisional one from T008 is superseded. Confirm the install resolves all eight members and record the resulting lock digest for the evidence pass.

**Checkpoint**: the frozen layout exists as real workspace members with a committed lockfile. User story work can begin.

---

## Phase 3: User Story 1 — Build the repository from a cold clone (Priority: P1) 🎯 MVP

**Goal**: an implementer clones, enters the container, runs the documented commands, and everything
installs and builds — the block that stops every downstream phase is removed.

**Independent Test**: from a checkout with no installed dependencies, run the documented install and
build commands inside the container and observe both complete, with the six libraries emitting type
declarations, declaration maps and source maps and both applications building.

### Implementation for User Story 1

- [x] T020 [US1] Run the root build `bash scripts/dev.sh exec bash -lc 'pnpm run build'` and confirm all eight members compile in dependency order with `packages/core` first.
- [x] T021 [US1] **Verification wiring — both halves of `plan.md` step 10.** **(a)** Populate `.sdd/commands.env` per `plan.md` D10: set `SDD_FULL_VERIFY_COMMAND` to exactly `pnpm install --frozen-lockfile && pnpm run verify` and leave `SDD_BUILD_COMMAND`, `SDD_LINT_COMMAND`, `SDD_TYPECHECK_COMMAND`, `SDD_UNIT_TEST_COMMAND` and `SDD_INTEGRATION_TEST_COMMAND` **empty**, with an in-file comment recording that the emptiness is deliberate (FR-031). Add no lint, format or test stage. **(b)** Then, inside the canonical container, run `bash scripts/dev.sh verify` and **require exit 0**. That run executes the configured frozen-lockfile install and the root build, so it leaves the workspace installed and built. **T022 must not begin until this verification exits 0** — the approved step 10 pairs the wiring with an immediately observed pass, so wiring that does not actually verify cannot flow into the Tech-Stack update or the evidence pass. This is the step-10 wiring check and is **not** a substitute for `P-VERIFY` (T028), which remains the separate D13 cold-state, fail-closed evidence probe.
- [x] T022 [US1] Make the narrow factual update to `Docs/Tech-Stack.md` per `plan.md` D12 — record the Node `24.20.0`, pnpm `11.24.0` and TypeScript `6.0.3` pins, the `>=24.0.0` engine range, ESM-only, `tsc -b` with project references, no bundler, and the F1 build/full-verification commands. **Leave the lint, typecheck, unit-test, integration-test and UI/E2E entries as `Phase 0 decision`** — the comprehensive rewrite is F3's. **This task must precede every evidence task (T023–T038)**, because `P-TECHSTACK` (T036) asserts against this file.

### Evidence for User Story 1 — strictly sequential

> **No `[P]` in this block.** Each probe either consumes or mutates workspace-wide install/build
> state, so they are ordered rather than parallelised. The order below is the only safe one.

- [x] T023 [US1] Run probe **`P-TOOLCHAIN`** per `quickstart.md` Scenario 1 — asserts `v24.20.0`, `11.24.0` **and `Version 6.0.3`** in a login shell. Placed here, after T008 installed the pinned TypeScript and after T022, so the complete D13 evidence pass sits after the Tech-Stack update (FR-008, FR-010, FR-027).
- [x] T024 [US1] Run probe **`P-LOCK`** per `quickstart.md` Scenario 2 — asserts the lockfile SHA-256 is unchanged across two clean frozen-lock installs and the virtual-store entry sets are identical, with a non-empty guard (FR-026, SC-007). **Removes and recreates workspace-wide `node_modules` twice**, so nothing may run concurrently; it leaves the tree installed.
- [x] T025 [US1] Run probe **`P-DIVERGE`** per `quickstart.md` Scenario 3 — mutating; asserts a divergent manifest is rejected with a non-zero raw status, the lock is untouched, restoration is byte-identical and the GREEN install is clean (SC-007). Mutates `packages/core/package.json` under a `trap`.
- [x] T026 [US1] Run probe **`P-BUILD`** per `quickstart.md` Scenario 6 — `pnpm run clean && pnpm run build`, then asserts `.js`, `.js.map`, `.d.ts` and `.d.ts.map` for each of the six libraries and an entry for each application (FR-014, FR-015, SC-003). **Requires the installed dependency tree left by T024/T025** and produces the `dist/` output consumed downstream.
- [x] T027 [US1] Run probe **`P-LOAD`** per `quickstart.md` Scenario 7 — asserts all six library entry points load synchronously by package name through the delivered `exports` map, with zero own keys (FR-013, SC-006). **Consumes the `dist/` output produced by T026.**
- [x] T028 [US1] Run probe **`P-VERIFY`** per `quickstart.md` Scenario 12 — asserts the exact `SDD_FULL_VERIFY_COMMAND` string, the five empty variables and the root `verify` script; **establishes a genuinely cold state — `pnpm run clean` while the pinned compiler is still installed, then deletes every `node_modules` and every member `dist`, asserting that no member `*.tsbuildinfo` survives**; runs `bash scripts/dev.sh verify`; then asserts the virtual store exists, the lock digest is unchanged and all eight members were built. Treat this task as complete only once the corrected probe passes **from an intentionally stale build-info state** (FR-029, FR-030, FR-031, SC-001, SC-011, SC-012). **Must run last in this phase and must never overlap `P-BUILD`, `P-LOCK`, `P-LOAD`, `P-ORDER` or the emitted-`.d.ts` inspection in `P-ZERO`.** It leaves the workspace installed and rebuilt. **T021's step-10 run does not supersede this probe**: T021 verifies the wiring from a warm tree, whereas `P-VERIFY` asserts the exact command surface and proves install and build from a deliberately emptied workspace.

**Checkpoint**: `bash scripts/dev.sh verify` exits 0 from a cold checkout. This is the MVP.

---

## Phase 4: User Story 2 — The frozen layout exists as real, resolvable packages (Priority: P2)

**Goal**: the repository contains exactly the frozen package and application layout, as real
workspace members carrying the identity and runtime metadata their role requires.

**Independent Test**: enumerate the workspace members and compare against the frozen layout — the
sets must match exactly; each library carries its `@chatter/` identity, version and runtime
requirement; each application is identified, non-publishable and declares no `exports`.

### Evidence for User Story 2

Both probes are **read-only with respect to the workspace** — they read manifests and workspace
metadata and write only under `/tmp` — so they are genuinely parallel-safe.

- [x] T029 [P] [US2] Run probe **`P-MEMBERS`** per `quickstart.md` Scenario 4 — asserts the raw project count is **9** (eight members plus the workspace root, which recursive `list` includes), that exactly one root project is named `chatter`, and that the sorted member **name** set and repo-relative **path** set each match the expected eight; asserts `bruno/` holds only `.gitkeep` (FR-001, FR-006, SC-002).
- [x] T030 [P] [US2] Run probe **`P-MANIFESTS`** per `quickstart.md` Scenario 5 — data-driven assertions over the six library, two application and one root manifest: names, library `version` exactly `0.0.0`, `type: module`, `engines.node`, the `exports` map with `types` before `default`, application `private: true` with no `exports`, and the root's `packageManager`, exact `typescript` devDependency, single devDependency, zero production dependencies and exact script set (FR-002–FR-005, FR-007, FR-012, FR-016, FR-032, FR-034). Verifies L1–L7 and A1–A6 mechanically.

**Checkpoint**: the layout is provably Chatter's, not merely a workspace that builds.

---

## Phase 5: User Story 3 — The dependency graph is explicit and architecturally valid (Priority: P3)

**Goal**: every internal dependency edge is explicit and permitted, and a package cannot use a
workspace dependency it has not declared.

**Independent Test**: enumerate all internal edges from manifests and project references and confirm
each is explicit and permitted; then introduce an undeclared cross-package import, observe the build
fail, revert, and observe install and build pass again.

### Evidence for User Story 3

- [x] T031 [P] [US3] Run probe **`P-EDGES`** per `quickstart.md` Scenario 8 — derives the edge set from all eight manifests **and** all eight `references` arrays, `diff`s each against the expected seven edges (dual declaration, contract C4.1), asserts every internal dependency **value** is exactly `workspace:*`, and asserts no external production dependency and no dev/peer/optional dependency on any member (FR-017, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, SC-004, SC-005). Verifies L8/L10 and A7/A8 mechanically. Read-only with respect to the workspace; writes only under `/tmp`.
- [x] T032 [US3] Run probe **`P-UNDECLARED`** per `quickstart.md` Scenario 9 — mutating; replaces `packages/slack/src/index.ts` with an import of `@chatter/telegram` under a `trap`, captures the **raw** build status as RED evidence, asserts it is non-zero, restores byte-identically, and asserts a clean GREEN install and build (FR-025, SC-005). Not parallel-safe: it mutates a tracked source file and runs workspace-wide builds. **Capture the RED output — T039 attaches it as TDD evidence.** Leaves the workspace installed and built.
- [x] T033 [US3] Run **`P-ORDER`** per `quickstart.md` Scenario 6 (*Inspecting the build order*) — `pnpm exec tsc -b --verbose`; confirm `packages/core` builds before every other member and that the graph is **two levels, not three** (the applications are direct dependants of core, not downstream of the libraries). **[inspection]** — no assertion; a wrong reference graph already fails T031. **Not parallel-safe**: `tsc -b` performs an incremental build when anything is out of date, so it writes `dist/` and `*.tsbuildinfo`. Requires a built workspace — T032 leaves one; if the tree has been cleaned since, run `pnpm run build` first.

**Checkpoint**: all three user stories are independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: the remaining cross-cutting evidence, the workflow record, and the human gate.

All five probes here are read-only with respect to the workspace, so they are parallel-safe with one
another. **T035 additionally requires that build output is present** — T032/T033 leave a built tree;
if it has been cleaned since, run `pnpm run build` before T035.

- [x] T034 [P] Run probe **`P-BASELINE`** per `quickstart.md` Scenario 10 — a no-dependency `node -e` asserting `Error.cause` and Web `ReadableStream` at the declared baseline (FR-009, SC-008).
- [x] T035 [P] Run probe **`P-ZERO`** per `quickstart.md` Scenario 11 — `cmp` each of the eight entry modules against the canonical `export {};` file, assert the count is 8, assert none of the nine enumerated manifests declares `publishConfig` or a publish script, and sweep tracked plus untracked files for release-automation artefacts (FR-035, SC-009, SC-010). Verifies L11 and A9 mechanically. Includes the **[inspection]** read of the six emitted `.d.ts`, which consumes build output and must not overlap `P-VERIFY` (T028).
- [x] T036 [P] Run probe **`P-TECHSTACK`** per `quickstart.md` Scenario 13 — asserts `Docs/Tech-Stack.md` records the exact pins, ESM-only, `tsc -b` and project references, **and** that `Phase 0 decision` placeholders remain so F1 has not performed F3's rewrite (FR-028 recording, SC-013). Depends on T022.
- [x] T037 [P] Run probe **`P-WORKFLOW`**: `bash scripts/dev.sh check` exits 0. A CODEOWNERS warning is expected and is F3's to resolve.
- [x] T038 [P] Run probe **`P-CI`** per `quickstart.md` Scenario 15 — asserts `git diff --stat main -- .github/` **and** `git status --porcelain --untracked-files=all -- .github/` are both empty, so committed, staged, modified and untracked workflow files are all caught (FR-031, SC-010). F1 makes no CI change.
- [x] T039 Record TDD evidence under `.sdd/tdd-evidence/` per `AGENTS.md`: run `bash scripts/tdd-evidence.sh skip …` with the human-reviewable rationale from `plan.md` → *Constitution Check* (F1 changes no behaviour, so a behavioural RED is not practical and must not be manufactured for `export {};`), and attach the genuine observed-failure → restore → observed-pass cycle captured by **`P-UNDECLARED`** in T032.
- [x] T040 Record the session/feature handoff: `bash scripts/handoff.sh --summary … --next-step …` inside the container, recording verification results, the TDD skip rationale, the `P-UNDECLARED` evidence, and any blocker encountered (notably risk R-1 below).
- [ ] T041 Open the pull request, let `quality.yml` and Tier 1 security run, and **stop for human review and merge approval**. The agent must not bypass branch protection or merge (`AGENTS.md`, `Docs/Repository-Settings.md`).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies. T001 → T002 strictly sequential (the image must be rebuilt before the toolchain can be confirmed). T003 → {T004, T005}; T006 → T007; **T003, T004, T006 and T007 must all precede T008**, because the preliminary install reads the root manifest and the workspace file.
- **Foundational (Phase 2)**: depends on Phase 1, and specifically on **T008** — `pnpm exec tsc` cannot resolve before it. **Blocks all user stories.**
- **User stories (Phases 3–5)**: all depend on Phase 2.
- **Polish (Phase 6)**: T036 depends on T022; T035 depends on a built workspace; T039 depends on T032; T040 depends on all evidence; T041 is last.

### Within-phase dependencies

- **T008 precedes T009** — the compile-alone check needs the locally installed pinned compiler.
- T009 precedes T010–T016 (every other member references `packages/core`).
- T018 follows T009–T017 (it edits the shared root solution `tsconfig.json`).
- **T019 follows T018 and precedes every build and probe.** Its lockfile — not T008's — is the committed artifact.
- **T020 → T021 (populate) → T021 (verify, exit 0) → T022** — sequential per `plan.md` steps 9–11, with the gate *inside* T021: the wiring is populated, then `bash scripts/dev.sh verify` must exit 0, and only then may T022 begin. T021's verification run is distinct from `P-VERIFY` (T028): T021 confirms the wiring works from the current warm tree; T028 proves the surface from a deliberately destroyed install and build state.
- **T022 precedes T023–T038**, the whole evidence pass; `P-TECHSTACK` cannot pass before the Tech-Stack update exists.
- **Phase 3 evidence is a strict chain: T023 → T024 → T025 → T026 → T027 → T028.** `P-LOCK` (T024) wipes and recreates `node_modules`; `P-BUILD` (T026) requires that installed tree and produces `dist/`; `P-LOAD` (T027) consumes that `dist/`; `P-VERIFY` (T028) destroys the install, the outputs **and the TypeScript build info** (`pnpm run clean`) before rebuilding, so it runs last. Clearing build info is load-bearing: `tsconfig.tsbuildinfo` sits beside each member `tsconfig.json`, not in `dist/`, so a dist-only deletion leaves `tsc -b` believing every project is current.
- T032 requires a built workspace and precedes T039.
- T033 requires a built workspace (left by T032) and performs an incremental build itself.
- T035's `.d.ts` inspection requires build output (left by T032/T033).

### Build-state ledger

Which tasks change workspace-wide install/build state, and what they leave behind:

| Task | Effect on `node_modules` | Effect on `dist/` | Leaves |
|---|---|---|---|
| T008 | creates (root devDependency only) | — | installed |
| T019 | recreates for all eight members | — | installed |
| T020 | — | creates | installed + built |
| T021 (verify run) | frozen-lockfile install via the configured full-verify command | rebuilds via `pnpm run verify` | installed + built |
| T024 `P-LOCK` | removes and recreates ×2 | — | installed |
| T025 `P-DIVERGE` | reinstalls (GREEN) | — | installed |
| T026 `P-BUILD` | — | cleans then rebuilds | installed + built |
| T027 `P-LOAD` | — | reads | installed + built |
| T028 `P-VERIFY` | **removes**, then reinstalls | `pnpm run clean` (outputs **and** build info), **removes**, then rebuilds | installed + built |
| T032 `P-UNDECLARED` | reinstalls (GREEN) | rebuilds | installed + built |
| T033 `P-ORDER` | — | may incrementally rebuild | installed + built |

Every other probe is read-only with respect to the workspace and writes only under `/tmp`.

### User story dependencies

- **US1 (P1)**: depends only on Phase 2. It is the MVP.
- **US2 (P2)**: depends only on Phase 2. Its probes need no build, so US2 can be verified without US1.
- **US3 (P3)**: `P-EDGES` needs no build; `P-UNDECLARED` and `P-ORDER` need a built workspace.

### Parallel opportunities

- **Phase 1**: T004 and T005 in parallel after T003.
- **Phase 2**: **T010–T017 are the largest parallel block** — eight independent scaffolds creating disjoint files with no workspace-state effect. T009 must land first; T018 must follow them all.
- **Phase 3**: **none.** The whole evidence chain is sequential by workspace state.
- **Phase 4**: T029 and T030 in parallel (both read-only).
- **Phase 5**: T031 in parallel with Phase 4 (read-only). T032 and T033 must each run alone.
- **Phase 6**: T034–T038 in parallel once T022 has landed and a built tree is present.
- **Across stories**: after Phase 2, the read-only probes T029, T030 and T031 can proceed alongside Phase 3 **only if** no Phase 3 evidence task is running concurrently, since T024/T026/T028 change workspace state under them. The simplest safe schedule is: finish Phase 3, then run T029–T031 in parallel.

### [P] audit

Every `[P]` marker below was checked against **filesystem effects and workspace state**, not only
against which files the description names.

| Task(s) | `[P]` | Effect class | Justification |
|---|---|---|---|
| T004, T005 | ✅ | file create/edit only | `pnpm-workspace.yaml` and `.gitignore` are disjoint; no workspace state exists yet |
| T010–T017 | ✅ | file create only | eight disjoint member directories; no command run, no install or build touched |
| T029, T030 | ✅ | read-only + `/tmp` writes | `pnpm list` and `jq` reads; no mutation of tracked files or workspace state |
| T031 | ✅ | read-only + `/tmp` writes | manifest and tsconfig reads only |
| T034, T036, T037, T038 | ✅ | read-only | `node -e`, file reads, `dev.sh check`, Git queries |
| T035 | ✅ | read-only (+ `mktemp`) | reads entries, `dist/*.d.ts`, manifests and `git ls-files`; the canonical file is a temp file |
| **T003** | ❌ | file create | must precede T004/T005 conceptually and T008 strictly |
| **T009** | ❌ | writes `packages/core/dist` + `tsbuildinfo` | runs a compile |
| **T018** | ❌ | shared file | edits the root solution `tsconfig.json` that T010–T017 all feed |
| **T019, T020** | ❌ | workspace-wide install / build | |
| **T023–T028** | ❌ | install and build state | see the build-state ledger; `P-LOCK` wipes `node_modules`, `P-BUILD` needs it, `P-VERIFY` destroys both |
| **T032** | ❌ | mutates a tracked source file; rebuilds | |
| **T033** | ❌ | may incrementally rebuild | `tsc -b --verbose` builds when out of date |
| **T039–T041** | ❌ | sequential workflow steps | |

**18 tasks carry `[P]`** (T004, T005, T010–T017, T029, T030, T031, T034–T038). Every one is either
file-creation-only or read-only with respect to install and build state.

---

## Parallel Example: Phase 2 member scaffolds

```bash
# After T009 (packages/core) lands, these eight create disjoint files with no workspace-state
# effect and can run together:
Task: "T010 Create packages/testing/{package.json,tsconfig.json,src/index.ts} per L1-L11"
Task: "T011 Create packages/whatsapp/{package.json,tsconfig.json,src/index.ts} per L1-L11"
Task: "T012 Create packages/slack/{package.json,tsconfig.json,src/index.ts} per L1-L11"
Task: "T013 Create packages/telegram/{package.json,tsconfig.json,src/index.ts} per L1-L11"
Task: "T014 Create packages/discord/{package.json,tsconfig.json,src/index.ts} per L1-L11"
Task: "T015 Create apps/validation-server/{package.json,tsconfig.json,src/main.ts} per A1-A10"
Task: "T016 Create apps/example-client/{package.json,tsconfig.json,src/main.ts} per A1-A10"
Task: "T017 Create bruno/.gitkeep"

# Then T018 wires all eight into the root solution tsconfig.json (shared file - run alone),
# and T019 regenerates the committed lockfile.
```

**Counter-example — do NOT parallelise the Phase 3 evidence chain**, even though the probes name
different scenarios: `P-LOCK` removes `node_modules` that `P-BUILD` needs, and `P-VERIFY` removes both
`node_modules` and `dist` that `P-LOAD`, `P-ORDER` and `P-ZERO` consume.

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 Setup — the container gains the pinned toolchain and the local compiler resolves.
2. Phase 2 Foundational — the frozen layout becomes real and the committed lockfile is produced.
3. Phase 3 User Story 1 — the workspace builds and `bash scripts/dev.sh verify` exits 0 from cold.
4. **STOP and VALIDATE**: US1 is independently demonstrable at this point.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → the repository is buildable and verifiable (MVP).
3. US2 → the layout is provably the frozen one.
4. US3 → the dependency graph is provably explicit and valid.
5. Polish → cross-cutting evidence, TDD record, handoff, human gate.

F1 ships as **one feature branch and one PR** (`AGENTS.md` — one Spec Kit feature = one branch = one
PR). The phases are review checkpoints, not separate PRs.

### Risk carried into implementation

**R-1 (implementation-time validation)** — strict isolated `node_modules` on the Windows bind mount
is unexercised. If it misbehaves, the fallbacks are **ordered**: first relocate `node_modules` to
container-local storage (preserves FR-025; needs a `compose.yaml` change, so it is a deliberate
recorded decision); `nodeLinker: hoisted` only as a last resort, because it **breaks FR-025** and
therefore requires explicit human approval and a recorded substitution in `Docs/Tech-Stack.md` — never
an implementer's judgement call. Timebox the debugging and escalate rather than expand.

---

## Requirements coverage

| Requirement | Task(s) |
|---|---|
| FR-001, FR-006 | T004, T017, T029 |
| FR-002 | T009–T017, T029, T030 |
| FR-003, FR-004, FR-005, FR-012 | T009–T016 (L1–L4, A1–A4), T030 |
| FR-007 | T003, T009–T016 (L4, A4), T030 |
| FR-008, FR-027 | T001, T002, T008, T022, T023, T036 |
| FR-009 | T034 |
| FR-010 | T003, T008, T023 |
| FR-011 | T006 — **[inspection]** of `tsconfig.base.json` against `plan.md` D5 |
| FR-013 | T009–T016 (L11, A9), T027 |
| FR-014, FR-015 | T018, T020, T026 |
| FR-016 | T003, T006, T030 |
| FR-017 | T018, T031, T033 |
| FR-018 | T005 — **[inspection]** |
| FR-019, FR-020, FR-021, FR-022, FR-023, FR-024 | T009–T016 (L7, L8, L10, A7, A8), T031 |
| FR-025 | T004, T032 |
| FR-026 | T019, T024, T025, T028 |
| FR-028 | T001, T022, T036 |
| FR-029, FR-030, FR-031 | T003, T021, T028, T038 |
| FR-032, FR-034 | T009–T016 (L6, A5), T030, T035 |
| FR-033 | **[inspection]** — recorded pre-publication requirement; nothing to execute |
| FR-035 | T009–T016 (L11, A9, A10), T027, T035 |
| SC-001, SC-011, SC-012 | T028 |
| SC-002 | T029 |
| SC-003 | T020, T026 |
| SC-004, SC-005 | T031, T032 |
| SC-006 | T027 |
| SC-007 | T024, T025 |
| SC-008 | T034 |
| SC-009 | T027, T035 |
| SC-010 | T035, T038 |
| SC-013 | T022, T036 |

### Probe coverage — all sixteen `plan.md` D13 labels

| Probe | Task | Kind |
|---|---|---|
| `P-TOOLCHAIN` | T023 | assertion |
| `P-LOCK` | T024 | assertion |
| `P-DIVERGE` | T025 | assertion (mutating) |
| `P-BUILD` | T026 | assertion |
| `P-LOAD` | T027 | assertion |
| `P-VERIFY` | T028 | assertion |
| `P-MEMBERS` | T029 | assertion |
| `P-MANIFESTS` | T030 | assertion |
| `P-EDGES` | T031 | assertion |
| `P-UNDECLARED` | T032 | assertion (mutating) |
| `P-ORDER` | T033 | **inspection** |
| `P-BASELINE` | T034 | assertion |
| `P-ZERO` | T035 | assertion + **inspection** |
| `P-TECHSTACK` | T036 | assertion + **inspection** |
| `P-WORKFLOW` | T037 | assertion |
| `P-CI` | T038 | assertion |

---

## Out of scope for these tasks

No task in this list may introduce any of the following. If a task appears to require one, stop and
raise it rather than widening scope.

- **F2**: ESLint, typescript-eslint, Prettier, Vitest, manifest boundary meta-tests, the
  contract-first harness, or any checked-in test suite. The probes above are one-off acceptance
  commands and are **not** wired into `pnpm run verify` or `.sdd/commands.env`.
- **F3**: CODEOWNERS, the LICENSE artifact, branch-protection configuration, the comprehensive
  `Docs/Tech-Stack.md` rewrite, or `bruno/README.md`.
- **Product behaviour**: Core APIs, message normalization, conversation semantics, capabilities,
  account lifecycle, error taxonomy, outbound sending, inbound handling, persistence, business logic.
- **Provider work**: any provider SDK dependency or import, any adapter behaviour for WhatsApp,
  Slack, Telegram or Discord, and any fake-provider semantics.
- **Applications**: routes, UI, transport or product behaviour in either app.
- **Publication**: publishing any package, adding release automation, or asserting ownership of the
  npm `@chatter` scope — which remains **unverified** and is a pre-publication requirement.
- **Toolchain substitutions**: a global TypeScript, `pnpm dlx`, an unpinned download, corepack, a
  bundler, or a monorepo orchestrator.
- **Never**: changes to the constitution, the frozen architecture records, `AGENTS.md`, the workflow
  scripts, `compose.yaml`, or any CI workflow.

---

## Notes

- `[P]` tasks are audited against filesystem **and** workspace-state effects; see the *[P] audit*.
- `[Story]` labels map tasks to `spec.md` user stories for traceability.
- Every command runs inside the canonical development container; host results are not evidence.
- Probe tasks are **fail-closed**: each is a self-contained script with its own `set -euo pipefail`
  and explicit `|| fail` on every mandatory comparison. Exit status is the verdict. Do not rely on
  inherited `errexit`.
- The two mutating probes (T025, T032) install `trap … EXIT INT TERM` **before** mutating, so files
  are restored on success, on assertion failure and on interruption.
- Two installs exist by design: T008 is preliminary working state; **T019 produces the committed
  lockfile**. Do not commit T008's provisional lock.
- Commit after each task or logical group; F1 ships as a single PR.
- Human approval gates this list before implementation, and gates the merge afterwards.
