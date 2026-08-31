# Phase 0 Research: Repository / Workspace Foundation

**Feature**: `001-repository-workspace-foundation` | **Date**: 2026-08-31

**Purpose**: resolve every version and mechanism unknown the approved `spec.md` deliberately deferred
to planning, with evidence gathered at planning time rather than recalled.

All queries below were executed **inside the canonical development container** on 2026-08-31 against
primary sources (`nodejs.org/dist`, the npm registry, and vendor documentation). Raw values are
quoted as returned.

---

## R1 — Exact Node.js version

**Decision**: **Node.js `24.20.0`**, pinned exactly in the development image; `engines.node` declared
as `>=24.0.0` in every manifest.

**Evidence** (`https://nodejs.org/dist/index.json`, filtered to the 24 line, newest first):

```text
v24.20.0  date=2026-08-26  lts=Krypton  npm=11.19.0
v24.19.0  date=2026-08-03  lts=Krypton  npm=11.17.0
v24.18.1  date=2026-07-28  lts=Krypton  npm=11.16.0
```

`https://raw.githubusercontent.com/nodejs/Release/main/schedule.json` → `v24`:

```json
{ "start": "2025-05-06", "lts": "2025-10-28", "maintenance": "2026-10-20",
  "end": "2028-04-30", "codename": "Krypton" }
```

**Rationale**:

- `24.20.0` is the newest release on the ratified major line, five days old at planning time.
- The line is **Active LTS today** and supported until **2028-04-30**, which comfortably outlives F1
  and the whole of Phase 0.
- FR-009's baseline capabilities are satisfied with margin: `Error.cause` has been available since
  Node 16.9 and the global Web `ReadableStream` since Node 18, so no frozen requirement has to be
  invented to justify the floor.
- It ships **npm 11.19.0**, which is the mechanism R3 uses to provision pnpm deterministically.

**Compatibility considerations for F1**:

- The line enters **maintenance on 2026-10-20**, roughly seven weeks after planning. That is a
  *scheduled bump*, not a risk: patch pins are expected to move, and the substitution procedure is
  not required for a patch-level move inside the ratified major line.
- Node 26 is the next line scheduled for LTS. Adding it to a CI matrix remains a later decision and
  is explicitly not F1 work.

**Alternatives considered**:

- *Track the `24` line without an exact pin* — rejected: FR-008 requires one exact release in
  reproducible surfaces, and an unpinned image silently changes the toolchain between builds.
- *Node 26* — rejected: outside the ratified major line and not yet LTS.
- *Node 24.19.0 or older* — rejected: no reason to pin a superseded patch.

---

## R2 — Exact pnpm version

**Decision**: **pnpm `11.24.0`**, declared in the root `packageManager` field and installed at that
exact version in the development image.

**Evidence** (`https://registry.npmjs.org/-/package/pnpm/dist-tags`, excerpt):

```json
{ "latest": "11.24.0", "latest-11": "11.24.0", "next-11": "11.25.0",
  "latest-10": "10.34.5", "next-12": "12.1.0" }
```

Publish times (`https://registry.npmjs.org/pnpm` → `.time`):

```text
11.23.0  2026-08-23T14:56:00.221Z
11.24.0  2026-08-24T14:56:01.051Z
11.25.0  2026-08-29T14:17:49.954Z
```

`https://registry.npmjs.org/pnpm/11.24.0` → `engines`: `{ "node": ">=22.13" }`

**Rationale**:

- `11.24.0` is the version on the **`latest`** dist-tag. `11.25.0` exists but is published only to
  **`next-11`**, and the 12 line only to **`next-12`** — neither is the stable channel. Pinning the
  stable channel head is the defensible choice, and "why not 12?" has a factual answer rather than a
  preference.
- `engines.node: >=22.13` is satisfied by the Node 24.20.0 pin.

**Compatibility considerations for F1** — three pnpm 11 behaviours materially shape the design:

1. **`.npmrc` is auth/registry only.** pnpm 11 reads its settings from `pnpm-workspace.yaml` (or the
   global `~/.config/pnpm/config.yaml`); all non-auth settings moved out of `.npmrc`. F1 therefore
   creates **no `.npmrc`**, contrary to what earlier assessment prose assumed.
2. **The CLI is pure ESM** and drops Node < 22 — consistent with the ESM-only direction.
3. **`pmOnFail` replaced** `managePackageManagerVersions`, `packageManagerStrict` and
   `packageManagerStrictVersion`. It governs what happens when the running pnpm differs from the
   declared `packageManager`.

**Open detail carried to implementation**: current pnpm documentation is *inconsistent about the
default value of `pmOnFail`* — the settings reference and the 11.0 release notes disagree (`ignore`
vs `download`). F1 therefore **sets the value explicitly** rather than relying on a default, which
makes the disagreement irrelevant. See R4.

**Alternatives considered**:

- *pnpm 11.25.0 / 12.x* — rejected: `next` channels, not `latest`.
- *corepack-provisioned pnpm* — rejected; see R3.

---

## R3 — Package-manager provisioning strategy

**Decision**: install Node from the official tarball and pnpm via **`npm install -g pnpm@11.24.0`**,
both into **system paths under `/usr/local`**, at image build time. **Do not use corepack.**

**Evidence** — Node 24 changelog (`doc/changelogs/CHANGELOG_V24.md`) contains both a live corepack
dependency bump and explicit removal notices:

```text
deps: update corepack to 0.35.0
doc: explicitly state that corepack will be removed in v25+
doc: clarify future Corepack removal in v25+
doc: note corepack package removal in distribution doc
```

**Rationale**:

- Corepack still ships in Node 24, but Node's own documentation states it is **removed in v25+**.
  Building F1's provisioning on it would guarantee a rewrite at the next runtime bump — a poor trade
  for a mechanism whose only job is "put an exact pnpm on `PATH`".
- **`HOME` is a mounted volume.** `compose.yaml` mounts the named volume `sdd-home` at `/sdd-home`,
  and the image sets `ENV HOME=/sdd-home`. A Docker named volume is seeded from image content only
  when the volume is **first created** — on any existing volume, image content written under
  `/sdd-home` is invisible. Corepack's shim directory lives under `HOME`, so a corepack-provisioned
  pnpm would be silently missing for every developer whose volume predates the image change. This is
  decisive, and it applies to **any** HOME-based install strategy.
- Installing to `/usr/local/bin` puts `node`, `npm` and `pnpm` on `PATH` for a **login shell**, which
  is what `scripts/verify.sh` uses (`bash -lc "$cmd"`). A `PATH` that only works in an interactive
  shell would break verification.
- Verifying the Node tarball against the published `SHASUMS256.txt` makes the image build
  reproducible and auditable, which suits a repository whose CI runs a security tier.

**Evidence that the artifacts are fetchable and checksummed** (`nodejs.org/dist/v24.20.0/`):

```text
5f4ddab610c1ab2016b3c227cebdbf6d9495161487e4739c7b90090595f465f7  node-v24.20.0-linux-arm64.tar.xz
2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2  node-v24.20.0-linux-x64.tar.xz
```

Both architectures are published, so the image must select by architecture rather than assuming
`x64` — the base image is used on both amd64 CI runners and arm64 developer machines.

**Alternatives considered**:

- *corepack* — rejected above (removed in v25+, and HOME-based).
- *NodeSource apt repository* — rejected: convenient for a major line, but pinning an exact patch and
  verifying it is more awkward than a checksummed tarball.
- *`@pnpm/exe` standalone binary* — viable, but adds a second distribution channel when npm is
  already present and pinned by the Node release.
- *Install into `HOME`* — rejected: masked by the `sdd-home` volume, as above.

---

## R4 — Reproducible install and lock strategy

**Decision**: commit `pnpm-lock.yaml`; verification-context installs run
`pnpm install --frozen-lockfile`; set `pmOnFail: error` and `engineStrict: true` in
`pnpm-workspace.yaml`.

**Rationale**:

- `--frozen-lockfile` fails rather than re-resolving or rewriting the lock when manifests and lock
  disagree — exactly the behaviour US1 acceptance scenario 4 and SC-007 require.
- **The evidence for lock immutability is a content digest, not Git state.** Comparing a SHA-256 of
  `pnpm-lock.yaml` before and after an install answers the actual question — "did the install rewrite
  the lock?" — and answers it identically whether the file is untracked, staged or committed. A
  `git status` check is the wrong instrument here: during F1 the lockfile is newly created, so
  `git status` reports it as untracked both when the install left it alone and when the install
  rewrote it. Companion evidence for "identical resolved dependency set" is the sorted entry list of
  the virtual store (`node_modules/.pnpm`) compared across two clean installs, which is the
  materialised resolution rather than a restatement of the lock.
- `pmOnFail: error` turns a pnpm-version drift between the image and the declared `packageManager`
  into a loud failure instead of a silent runtime download. It also removes F1's dependence on the
  ambiguous documented default (R2), and avoids a network fetch during verification.
- `engineStrict: true` makes a wrong Node major fail at install time with a clear message, which is
  the behaviour the spec's first edge case asks for.
- Settings live in `pnpm-workspace.yaml`, not `.npmrc` (R2).

**Alternatives considered**:

- *`pmOnFail: download`* — rejected: reintroduces a runtime network dependency and can silently run a
  pnpm other than the pinned one.
- *`pmOnFail: ignore`* — rejected: fails silently open, which is the opposite of a reproducibility
  guarantee.
- *No lockfile* — rejected outright by FR-026.

---

## R5 — Exact TypeScript version

**Decision**: **TypeScript `6.0.3`**, pinned exactly.

**Evidence** (`https://registry.npmjs.org/typescript`):

```text
dist-tags: { "latest": "7.0.2", "beta": "6.0.0-beta", "next": "7.1.0-dev.20260831.1" }

stable 6.x releases:
  6.0.2  2026-03-23T16:14:45.521Z
  6.0.3  2026-04-16T23:38:27.905Z
```

`https://registry.npmjs.org/typescript/6.0.3` → `engines`: `{ "node": ">=14.17" }`

**Rationale**:

- `6.0.3` is the newest stable release on the ratified TypeScript 6 line. There is no 6.1 line; 6.0.3
  is the head of TS 6.
- It supports everything F1's build needs: `--build`, project references, composite projects,
  declaration emit, declaration maps and source maps.

**Compatibility considerations for F1**:

- TypeScript 7.0.2 is the `latest` tag but **does not yet expose a stable programmatic API**, and its
  own release notes name `typescript-eslint` as blocked by that gap. F2's type-aware linting is the
  reason the ratified decision selected TS 6, so nothing here reopens it.
- TS 6 is a deliberate transition release: *"TypeScript 7.0 adopts 6.0's new defaults, and provides
  hard errors in the face of any flags and constructs deprecated in TypeScript 6.0."* This is what
  makes FR-011's "mechanical migration" achievable rather than aspirational.
- The TS 6 line is patched infrequently (last stable 2026-04-16) now that 7.x is current. This is
  acceptable for F1 and is a factor F2/F3 should revisit, not a defect.

**Alternatives considered**:

- *TypeScript 7.0.2* — excluded by the ratified decision and by FR-011.
- *TypeScript 6.0.2* — rejected: superseded.

---

## R6 — Making the TypeScript 7 migration mechanical (FR-011)

**Decision**: state every setting whose default changes between TS 6 and TS 7 **explicitly** in the
shared base configuration, and additionally enable TS 6's forward-compatibility flag.

**Evidence** — the TypeScript 7.0 announcement lists these default changes relative to 6:

| Option | TS 7 default |
|---|---|
| `rootDir` | `./` (inner source directories must be set explicitly) |
| `types` | `[]` (restore old behaviour with `["*"]`) |
| `strict` | `true` |
| `module` | `esnext` |
| `target` | the stable ECMAScript version preceding `esnext` |
| `noUncheckedSideEffectImports` | `true` |
| `stableTypeOrdering` | `true`, and cannot be disabled |

The TypeScript 6.0 release notes additionally record that `types` **already** defaults to `[]` in 6.0,
that the lowest supported `target` is now ES2015 (`target: es5` deprecated, and `downlevelIteration`
consequently pointless), and that 6.0 introduces `--stableTypeOrdering` specifically so *"6.0's type
ordering behavior match[es] 7.0's, reducing the number of differences between the two codebases."*

**Rationale**: writing each of these explicitly today means the eventual migration changes the
compiler, not the semantics. `stableTypeOrdering: true` is the single highest-value flag here — it is
non-default in 6, mandatory in 7, and free to adopt on an empty repository.

**Note for the implementer**: `module` is set to `nodenext`, **not** the TS 7 default `esnext`. That
is deliberate — `nodenext` is what makes TypeScript model Node's own ESM resolution and honour the
`exports` map. It must stay explicit precisely because the TS 7 default differs.

---

## R7 — Build mechanism and the composite-project consequence

**Decision**: one root solution `tsconfig.json` containing only project references; a shared
`tsconfig.base.json` carrying compiler options; **all eight** workspace members are `composite: true`;
the root build is a single `tsc -b`.

**Rationale and the one real tension**:

`tsc -b` requires every project listed in `references` to have `composite: true`, and `composite`
forces `declaration: true`. FR-014 requires **one** root command to build all eight members, so all
eight must be referenced, so all eight are composite, so both applications emit `.d.ts` as a build
by-product.

FR-015 says applications *"MUST NOT be **required** to emit library declarations."* This design does
not impose that requirement as a consumability contract: the applications are `private: true`, declare
no `exports` map, publish nothing, and no consumer reads their declarations. Their `.d.ts` output is
incidental build-tool state living in ignored output directories, in the same category as
`.tsbuildinfo`. Recording this explicitly so a later reviewer does not read it as a spec violation.

**Alternative considered and rejected**: reference only the six libraries from the solution file and
build each application with a separate `tsc -p` invocation, keeping applications non-composite. This
honours FR-015 more literally but breaks FR-014's single root command into three, loses cross-project
incremental build ordering for the applications, and trades a real capability for a cosmetic one. If
the reviewer prefers the literal reading, this is the substitution point — it is a one-line change to
the root script and the solution file.

**Alternatives considered for the build tool**: none. `tsc -b` with project references and no bundler
is a ratified decision.

---

## R8 — Minimal source content that satisfies both "buildable" and "zero behaviour"

**Decision**: every member's entry module is a single file whose entire content is `export {};`.

**Rationale**:

- `tsc` fails with *"No inputs were found in config file"* against an empty project, so each member
  needs at least one source file — "empty directory" is not a buildable package.
- `export {};` makes the file an ES module while exporting **nothing**. That is the exact literal
  satisfaction of FR-035 ("MUST export zero Chatter domain types, values, functions, classes") and of
  SC-009, and it is impossible to mistake for the beginning of an implementation.
- It emits a valid `.js`, `.d.ts`, `.d.ts.map` and `.js.map`, so it exercises the whole build output
  contract without introducing a single line of behaviour.
- It contains no top-level await. That satisfies FR-013 in the source, but **source content is not
  evidence that the built package loads** — see R14, which supplies the executable proof.

**Alternatives considered**:

- *A placeholder `version` constant or a marker type* — rejected: it is an exported symbol, and
  FR-035 says zero.
- *`allowJs` with an empty `.js` file* — rejected: no declaration emit, and it weakens the config.

---

## R9 — Verification wiring

**Decision**: populate **only** `SDD_FULL_VERIFY_COMMAND` in `.sdd/commands.env`, as
`pnpm install --frozen-lockfile && pnpm run verify`, where the root `verify` script is exactly
`pnpm run build` in F1. Leave the other five variables empty.

**Evidence** — `scripts/verify.sh` short-circuits:

```bash
if [[ -n "${SDD_FULL_VERIFY_COMMAND:-}" ]]; then
  run_cmd "full verification" "$SDD_FULL_VERIFY_COMMAND"
  exit 0
fi
```

and the schema has **six variables and no install variable**:
`SDD_BUILD_COMMAND`, `SDD_LINT_COMMAND`, `SDD_TYPECHECK_COMMAND`, `SDD_UNIT_TEST_COMMAND`,
`SDD_INTEGRATION_TEST_COMMAND`, `SDD_FULL_VERIFY_COMMAND`.

**Rationale**:

- The schema has nowhere to express "install first", and the file's own header prefers a single
  full-verify command. Folding the frozen-lock install into that one command closes the gap without
  inventing a variable or editing the workflow mechanism.
- Because `verify.sh` short-circuits, populating the granular variables as well would create config
  that never executes. Leaving them empty is the honest state and directly satisfies FR-031's "MUST
  remain unpopulated" for lint/format/unit/integration.
- Routing through a root `verify` script rather than calling `tsc -b` directly gives F2 a seam: F2
  extends the `verify` script with lint, typecheck and tests without touching `.sdd/commands.env` or
  `scripts/verify.sh`. In F1 the script genuinely does only what it claims.

**Alternatives considered**:

- *Leave full-verify empty and prefix the install onto `SDD_BUILD_COMMAND`* — workable, and it keeps
  `verify.sh`'s per-stage labels. Rejected because it fights the file's stated preference and still
  hides an install inside a build.
- *Populate all six now* — rejected: falsely claims lint and test stages that do not exist.

---

## R10 — CI integration

**Decision**: **no change to `.github/workflows/quality.yml`.**

**Evidence** — the existing job already builds the canonical image and runs verification inside it:

```yaml
- name: Build canonical development container
  run: export SDD_HOST_UID="$(id -u)" SDD_HOST_GID="$(id -g)"; docker compose build dev
- name: Run project verification in canonical container
  run: bash scripts/dev.sh verify
```

**Rationale**: because CI executes verification *inside the same container*, putting Node and pnpm in
the image serves local and CI execution identically. No `setup-node`, no second toolchain, no
workflow edit, and no parallel CI mechanism — which is precisely what FR-031 asks for.

**Implementation note**: CI has no dependency cache and performs no separate install step. The
frozen-lock install folded into `SDD_FULL_VERIFY_COMMAND` (R9) is what makes the CI run complete.

---

## R11 — Windows bind-mount / link-layout operational unknown (spec risk R2)

**Decision**: proceed with pnpm's default `nodeLinker: isolated`, and treat any misbehaviour as an
implementation-time validation with a **pre-ordered** fallback list.

**Rationale**: strict isolated linking is what makes FR-025 true — a package resolves only what it
declares. The two candidate fallbacks are not equivalent:

| Fallback | Effect on FR-025 | Verdict |
|---|---|---|
| Relocate `node_modules` off the bind mount into container-local storage | **Preserved** — still isolated | **Preferred fallback.** Requires a `compose.yaml` change, so it is a deliberate, recorded decision. |
| `nodeLinker: hoisted` | **Broken** — undeclared imports resolve silently | **Last resort.** Materially weakens an approved requirement, so it requires explicit human approval and a recorded substitution, not an implementer's judgement call. |

**Rationale for ordering**: a fallback that silently removes the guarantee the feature exists to
provide is worse than one that costs a configuration change. The implementer must not reach for
`hoisted` to make a slow install faster.

**Timebox**: if isolated linking on the bind mount is not working within a bounded debugging effort,
stop and escalate the choice rather than expanding the investigation.

---

## R12 — `Docs/Tech-Stack.md` scope

**Decision**: replace only the `Phase 0 decision` markers for the choices F1 actually materializes,
and leave the rest untouched.

| Entry | F1 action |
|---|---|
| Language/runtime | Record Node `>=24.0.0` engine range, image pin `24.20.0`, TypeScript `6.0.3` |
| Package/dependency manager | Record pnpm `11.24.0` + workspace mechanism |
| Build command | Record the root build command |
| Full verification command | Record the F1 full-verify command |
| Module format / build tooling | Add: ESM-only, `tsc -b` with project references, no bundler |
| Lint / Typecheck / Unit test / Integration test / UI-E2E | **Leave as `Phase 0 decision`** — these are F2 |

**Rationale**: FR-028 authorises a narrowly scoped factual recording; the comprehensive rewrite and
the removal of the remaining placeholders is explicitly F3 work. Recording a typecheck command would
be misleading, since `tsc -b` covers typechecking as part of the build and a separate no-emit
typecheck command is an F2 decision.

---

## R13 — Workspace enumeration semantics

**Decision**: enumerate members from `pnpm list --recursive --depth -1 --json`, **filter out the
entry whose `path` is the workspace root**, then compare the remaining sorted name set *and* sorted
repo-relative path set against a checked expected list. Never verify membership by counting raw
output rows.

**Finding**: pnpm's recursive `list` operates on **every workspace project, including the workspace
root**. The root-exclusion behaviour that applies to commands such as `exec`, `run`, `test` and `add`
does **not** apply to `list`. Raw `pnpm list -r --depth -1` in this workspace therefore reports
**nine** projects — the root plus the eight members.

**Consequence**: an earlier draft of this plan asserted that the raw command "returns exactly eight
members". That was wrong and would have produced an acceptance check that either always failed or,
if written as a count, silently drifted. SC-002 is unchanged and unweakened; only the method of
proving it is corrected — the replacement is strictly stronger than a count because it compares the
exact identity of every member rather than how many there are.

**Supporting decision**: the root `package.json` declares `name: "chatter"`, so the root is
identifiable in raw output as well. The filter still discriminates on `path` rather than `name`, so
renaming the root cannot break the check.

**Alternatives considered**:

- *Count rows and expect eight* — rejected: wrong today, and a count cannot detect a member that was
  renamed or moved to the wrong directory.
- *Derive membership from the `packages:` globs by listing directories* — rejected: it tests the
  filesystem rather than what pnpm actually resolved, so it would pass on a member whose manifest is
  malformed and which pnpm therefore ignored.
- *Use `pnpm -r exec` to enumerate, exploiting its root exclusion* — rejected: it executes a command
  per member to answer a question about metadata, and fails on a member for reasons unrelated to
  membership.

---

## R14 — Proving that library entry points load (SC-006)

**Decision**: after the build, load each of the six library entry points with

```bash
node --input-type=commonjs -e "require('@chatter/<name>')"
```

executed with that package as the working directory, and fail the probe on any non-zero exit.

**Why an executable probe is required**: SC-006 states that library entry points *load successfully*
without asynchronous module evaluation. Reading `src/` for `await` cannot establish that. The source
can be clean while the package is still unloadable — the `exports` map may point at a path that does
not exist, its conditions may be ordered wrongly, or the emitted output may be invalid. All three are
realistic failures for a first-ever build configuration, and all three are invisible to source
inspection.

**Why this specific mechanism**:

1. **Resolution by package name, not by file path.** Node supports *self-referencing a package using
   its own name* when the package declares an `exports` field. Running from inside the package and
   requiring `@chatter/<name>` therefore resolves **through the delivered `exports` map**, which is
   exactly the entry-point configuration contract C2.2 defines. A file-path load would bypass the
   thing under test.
2. **`require()` of an ES module is the synchronicity test.** `require(esm)` is unflagged on the
   pinned Node 24 baseline, and Node throws **`ERR_REQUIRE_ASYNC_MODULE`** when the target graph
   requires asynchronous evaluation. So the probe fails automatically and specifically if top-level
   await ever enters an entry graph — which is FR-013's constraint expressed as a runtime check
   rather than a promise.
3. **`--input-type=commonjs` is explicit** because every manifest declares `"type": "module"`, and
   the probe must be evaluated as CommonJS for the interop path to be exercised at all.
4. **Zero dependencies.** No test runner, no loader, no `@types/node` — nothing that would pull F2
   tooling into F1.

**Scope boundary**: this proves *Chatter's own* entry graphs are synchronously loadable. Per FR-013
it must not be restated as a promise of universal legacy CommonJS compatibility. Applications are
excluded — they declare no `exports` map and are not consumable packages.

**Bonus assertion**: the value returned by `require()` is the module namespace, so the probe also
asserts it has zero own enumerable keys, giving SC-009 a runtime check alongside its inspection.

**Fail-closed shape**: the probe runs the six loads in a loop that captures each raw exit status
rather than letting `errexit` abort at the first failure — so a single run reports *every* broken
package — and then fails the probe if the collected failure list is non-empty. Reporting a failure
without failing the probe would defeat the point, so the final check is an explicit assertion, not a
`&& echo`.

**Alternatives considered**:

- *Source inspection for `await`* — rejected: the finding that prompted this section. It tests the
  wrong artefact.
- *Dynamic `import()` from ESM* — useful as an ordinary-consumption check, but it does **not**
  distinguish synchronous from asynchronous evaluation: `import()` succeeds on a graph with top-level
  await. It is therefore complementary, not a substitute.
- *Wiring the probe into `pnpm run verify`* — rejected: it would need a checked-in script, which is
  the beginning of the test layer F2 owns. The probe is acceptance evidence recorded during F1
  implementation.

---

## Resolved unknowns summary

| # | Unknown from spec | Resolution |
|---|---|---|
| FR-008 | exact Node 24.x release | `24.20.0` (R1) |
| FR-027 | exact pnpm version | `11.24.0` (R2) |
| FR-010 | exact TypeScript 6.x version | `6.0.3` (R5) |
| FR-011 | what "mechanical TS 7 migration" requires | explicit defaults + `stableTypeOrdering` (R6) |
| FR-027/028 | how the container provides the toolchain | checksummed tarball + `npm -g`, system paths, no corepack (R3) |
| FR-026 | lock and reproducibility mechanism | committed lock, `--frozen-lockfile`, `pmOnFail: error`, `engineStrict` (R4) |
| FR-031 | verification command wiring | full-verify only, routed through a root `verify` script (R9) |
| FR-031 | CI integration | no workflow change required (R10) |
| FR-014/015 | build mechanism and the app-declaration consequence | one `tsc -b`, all members composite, documented (R7) |
| FR-035 | minimal buildable zero-behaviour source | `export {};` (R8) |
| spec risk R2 | bind-mount link layout | ordered fallbacks, escalation required for `hoisted` (R11) |
| FR-028 | Tech-Stack recording scope | narrow factual update only (R12) |
| SC-002 | how to enumerate members deterministically | root-filtered, sorted name/path set comparison — never a count (R13) |
| FR-013, SC-006 | how to prove entry points load synchronously | post-build `require()` self-reference probe against `dist/` (R14) |
| SC-007 | how to prove lock immutability independent of Git state | SHA-256 content digest plus virtual-store set comparison (R4) |

**No `NEEDS CLARIFICATION` markers remain.**

---

## Sources

- Node.js release index — `https://nodejs.org/dist/index.json`
- Node.js release schedule — `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json`
- Node.js v24.20.0 checksums — `https://nodejs.org/dist/v24.20.0/SHASUMS256.txt`
- Node.js v24 changelog (corepack removal notices) — `nodejs/node` `doc/changelogs/CHANGELOG_V24.md`
- npm registry — `https://registry.npmjs.org/pnpm`, `.../pnpm/11.24.0`, `.../-/package/pnpm/dist-tags`
- npm registry — `https://registry.npmjs.org/typescript`, `.../typescript/6.0.3`
- pnpm settings reference — `https://pnpm.io/settings`, `https://pnpm.io/pnpm-workspace_yaml`,
  `https://pnpm.io/settings/node-modules`
- pnpm workspaces — `https://pnpm.io/workspaces`
- pnpm 11.0 release notes — `https://pnpm.io/blog/releases/11.0`
- TypeScript 7.0 announcement — `https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/`
- TypeScript 6.0 release notes — `https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html`
- Repository records (read-only): approved `spec.md`, `.specify/memory/constitution.md`,
  `Docs/Architecture/*`, `Docs/Tech-Stack.md`, `Docs/Privacy-Compliance.md`, `.devcontainer/Dockerfile`,
  `compose.yaml`, `scripts/verify.sh`, `scripts/dev.sh`, `.sdd/commands.env`,
  `.github/workflows/quality.yml`, `.gitignore`
