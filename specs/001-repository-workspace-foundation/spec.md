# Feature Specification: Repository / Workspace Foundation

**Feature Branch**: `001-repository-workspace-foundation`

**Created**: 2026-08-31

**Status**: Approved for technical planning

**Human Spec Approval**: 2026-08-31 — **APPROVED** (`P0: 0`, `P1: 0`, `P2: 0`; no remaining clarification required)

**Input**: User description: "F1: Repository / Workspace Foundation — establish the minimum buildable Chatter monorepo skeleton that must exist before any Chatter Core behaviour can be implemented. This is the first feature of Phase 0 and it is NOT the whole of Phase 0."

**Assessment**: `.specify/assessments/phase-0-repository-foundation/` (verdict `go`, 2026-08-31)

Chatter today has a ratified constitution, a frozen Core contract and a sequenced roadmap, but no
repository anyone can build. There is no workspace, no package that resolves, no language baseline,
and no JavaScript runtime in the canonical development environment. Until that changes, no Chatter
feature can be implemented, verified, or merged under the project's own rules.

This feature delivers the smallest repository foundation that removes that block: the frozen package
layout made real, a declared language and runtime baseline, a dependency graph that matches the
frozen architecture, and a workspace that installs and builds inside the canonical development
environment. It introduces **no Chatter behaviour of any kind**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build the repository from a cold clone (Priority: P1)

An implementer — a coding agent or the maintainer — clones the repository, enters the canonical
development environment, and runs the documented commands. Dependencies install, every workspace
member compiles, and the six library packages emit their consumable library artifacts. Nothing about
the sequence is folklore: the commands are discoverable from the repository, and no manual step
happens outside the development environment.

**Why this priority**: This is the block. Every later phase, every verification run, and every
honest PR checklist tick depends on this single path working. If only this story ships, the project
has moved from "cannot start" to "can start".

**Independent Test**: From a checkout with no previously installed dependencies, run the documented
install and build commands inside the canonical development environment and observe both complete
successfully. The single root build covers all eight workspace members; the six library packages
produce type declarations, declaration maps and source maps, while the two applications successfully
compile/build according to their application role.

**Acceptance Scenarios**:

1. **Given** a clean checkout with no installed dependencies, **When** the implementer runs the
   documented install command inside the canonical development environment, **Then** installation
   completes successfully and resolves every workspace member.
2. **Given** a successful install, **When** the implementer runs the single documented root build
   command, **Then** all six library packages and both applications compile/build in correct
   dependency order; each library package emits type declarations, declaration maps and source maps,
   while neither application is required to emit library declarations.
3. **Given** the same checkout and the committed dependency lock, **When** installation is repeated,
   **Then** the resolved dependency set is identical to the previous run.
4. **Given** manifests that disagree with the committed dependency lock, **When** the verification-
   context install is attempted, **Then** installation fails rather than updating the lock or
   re-resolving a different dependency set.
5. **Given** the canonical development environment, **When** the implementer checks for the language
   runtime and the package manager, **Then** both are present at the exact versions the reproducible
   execution surface declares.

---

### User Story 2 - The frozen layout exists as real, resolvable packages (Priority: P2)

A reviewer or implementer opens the repository and finds exactly the package and application layout
the frozen architecture specifies — not empty folders, but real workspace members that resolve, carry
the identity and runtime metadata appropriate to their role. Library packages carry independent
versions; applications are non-publishable and acquire no independent-version requirement here. A
later feature can begin adding behaviour to `@chatter/core` without first inventing where it lives.

**Why this priority**: Story 1 proves a workspace builds; this story proves it is *Chatter's*
workspace. Without it the foundation could build while being structurally wrong, which is far more
expensive to correct once real code exists.

**Independent Test**: Enumerate the workspace members and compare against the frozen layout — the
sets must match exactly. Each library package has its approved identity, independent version and
declared runtime requirement; each application has an identity, a declared runtime requirement and
non-publishable status.

**Acceptance Scenarios**:

1. **Given** the repository, **When** the workspace members are enumerated, **Then** the set is
   exactly the six library packages and two applications of the frozen layout — none missing, none
   extra.
2. **Given** any library package, **When** its manifest is inspected, **Then** it carries the
   approved `@chatter/<name>` identity, an independent version, and a declared minimum runtime.
3. **Given** either application, **When** its manifest is inspected, **Then** it has an identity and
   declared runtime requirement and is marked non-publishable; no independent-version requirement is
   imposed on applications by this feature.
4. **Given** the repository, **When** the acceptance directory reserved for API acceptance
   collections is inspected, **Then** it exists as part of the frozen layout and contains no
   collections or tests.

---

### User Story 3 - The dependency graph is explicit and architecturally valid (Priority: P3)

An implementer or reviewer can enumerate every internal dependency edge from package manifests and
the declared build graph. The delivered graph contains no forbidden edge, and a package cannot use an
undeclared workspace dependency merely because another package happens to have installed it. F1 owns
those workspace-resolution and build-graph guarantees; automated rejection of a deliberately
declared forbidden edge arrives with F2's lint restrictions and manifest meta-tests.

**Why this priority**: The frozen dependency direction must be true from the first buildable
workspace. F1 can make every edge explicit, deliver a conforming graph and reject undeclared imports
without pulling F2's lint and manifest-test layers into this feature.

**Independent Test**: Enumerate all internal edges from manifests and project references and confirm
that every edge is explicit and permitted. Then introduce an undeclared cross-package import, observe
that resolution or compilation fails, revert it, and observe that installation and the root build
pass again.

**Acceptance Scenarios**:

1. **Given** the delivered workspace, **When** internal dependency edges are enumerated from package
   manifests and project references, **Then** every edge is explicit and the graph contains zero
   forbidden internal edges.
2. **Given** any workspace package, **When** it imports another workspace package that it has not
   declared, **Then** the reference fails to resolve or compile.
3. **Given** the declared project-reference graph, **When** it is compared with the frozen package
   boundaries, **Then** every build edge follows a permitted architectural direction.
4. **Given** the undeclared import is reverted, **When** the verification-context install and root
   build are re-run, **Then** both pass with no residual state.

---

### Edge Cases

- **The declared runtime is absent or the wrong major version.** Install or build must fail with a
  clear statement of the required baseline rather than proceeding and failing later in a confusing
  way.
- **Someone installs or builds outside the canonical development environment.** The repository does
  not need to prevent this, but its documented path is the container one, and results obtained
  elsewhere are not evidence.
- **A package entry point acquires asynchronous top-level evaluation.** The entry graph must remain
  synchronously loadable; an entry that cannot be loaded synchronously is a defect against this
  feature, not an acceptable variation.
- **A new directory appears under the package or application roots.** It is either a declared
  workspace member or it is not part of the frozen layout; there is no third state.
- **The dependency lock and the manifests disagree.** A reproducible install must fail rather than
  silently resolve something different.
- **A package builds but emits no type declarations.** A library package without declarations is not
  consumable and does not satisfy the build outcome.
- **Strict, link-based dependency layout misbehaves on the host's mounted filesystem.** This is a
  known operational unknown carried into implementation; a fallback layout is permitted only through
  the recorded stack-substitution procedure, and the feature outcome (a reproducible install) does
  not change.

## Requirements *(mandatory)*

### Functional Requirements

**Workspace and package identity**

- **FR-001**: The repository MUST define a single workspace whose members are exactly the frozen
  library packages (`packages/core`, `packages/testing`, `packages/whatsapp`, `packages/slack`,
  `packages/telegram`, `packages/discord`) and the frozen applications (`apps/validation-server`,
  `apps/example-client`).
- **FR-002**: Every frozen workspace member MUST be a real, resolvable package — a directory with a
  manifest that the workspace recognises — not an empty placeholder directory.
- **FR-003**: Library packages MUST use the approved naming convention `@chatter/core`,
  `@chatter/testing`, `@chatter/whatsapp`, `@chatter/slack`, `@chatter/telegram`,
  `@chatter/discord`.
- **FR-004**: Each application MUST carry a package identity and MUST be marked non-publishable.
- **FR-005**: Each library package MUST carry its own version so that packages can be versioned
  independently.
- **FR-006**: The acceptance-collection directory (`bruno/`) MUST exist as part of the frozen layout
  and MUST remain empty of collections or tests in this feature.

**Runtime and language baseline**

- **FR-007**: The workspace and every package MUST declare a minimum runtime of Node.js 24 or later.
- **FR-008**: Reproducible execution surfaces — the development image and CI — MUST pin one exact
  Node.js 24.x release. The exact release MUST be selected during implementation planning against
  the then-current releases; it MUST NOT be copied from planning prose or invented in this
  specification.
- **FR-009**: The declared baseline MUST support native error-cause chaining and Web byte streams,
  because the frozen Core contract depends on both. This MUST be demonstrable at the declared
  baseline rather than assumed.
- **FR-010**: The repository MUST adopt the TypeScript 6 line at an exact pinned version.
- **FR-011**: TypeScript configuration MUST be written so that a future migration to TypeScript 7
  is reasonably mechanical — settings whose defaults change in that line MUST be stated explicitly
  rather than left implicit. TypeScript 7 MUST NOT be adopted in this feature.

**Module format**

- **FR-012**: All Chatter packages MUST be ECMAScript-module-only. No CommonJS build artifact is
  produced or published.
- **FR-013**: Every public package entry graph MUST remain synchronously loadable and MUST NOT
  depend on top-level await where doing so would unnecessarily break modern Node.js
  `require`-of-ESM interoperability. This is a constraint on Chatter's own entry graphs; it is
  **not** a promise of universal legacy CommonJS compatibility.

**Build**

- **FR-014**: A single root command MUST compile/build all eight workspace members — all six library
  packages and both applications — in correct dependency order.
- **FR-015**: The build MUST emit type declarations, declaration maps and source maps for every
  library package, so each library is consumable as a typed package. Both applications MUST
  successfully compile/build according to their application role and MUST NOT be required to emit
  library declarations.
- **FR-016**: The build MUST NOT bundle. No bundler is introduced by this feature.
- **FR-017**: The build graph MUST be declared explicitly and MUST mirror the architectural
  dependency direction, so that an edge which should not exist has to be added deliberately and
  visibly.
- **FR-018**: Build outputs and installed dependencies MUST be excluded from version control.

**Dependency direction and boundaries**

- **FR-019**: Provider packages MAY depend on the core package. The core package MUST NOT depend on
  any provider package, and MUST NOT depend on any provider SDK.
- **FR-020**: Provider packages MUST NOT depend on one another.
- **FR-021**: `@chatter/testing` is test and development infrastructure. It MUST NOT appear as a
  production dependency of any package or application.
- **FR-022**: Applications MAY depend on Chatter packages. They MUST NOT redefine Core, MUST NOT
  depend on provider SDKs directly, and the example client MUST NOT bypass Chatter to reach provider
  behaviour.
- **FR-023**: No provider SDK may be reachable from browser-facing code.
- **FR-024**: Internal dependencies between workspace members MUST be expressed as workspace-local
  references rather than registry versions.
- **FR-025**: A package MUST be able to resolve only what it declares: an undeclared cross-package
  reference MUST fail rather than silently succeed through a shared dependency layout.

The requirements above constrain the delivered F1 graph. F1-owned enforcement is limited to strict
workspace resolution, explicit manifests and project references, and the declared build graph.
Automated rejection of a deliberately declared forbidden edge — including a production dependency on
`@chatter/testing` — belongs to F2's lint restrictions and manifest meta-tests.

**Installation and the development environment**

- **FR-026**: The dependency lock MUST be committed, and verification-context installs MUST be
  reproducible from it rather than free to re-resolve.
- **FR-027**: The canonical development environment MUST provide the language runtime and pnpm at
  exact versions declared and pinned by the repository, so that local and CI execution use the same
  reproducible toolchain. The exact pnpm version MUST be selected during implementation planning and
  MUST NOT be invented in this specification.
- **FR-028**: Container support MUST be added by extending the existing development image at its
  sanctioned extension point. This feature MUST NOT create a parallel Chatter-specific development
  environment, and MUST preserve the container-first execution model. Once planning has selected the
  exact F1 tooling and commands, this feature MUST make a narrowly scoped factual update to
  `Docs/Tech-Stack.md` recording only the operational choices it materializes: the exact Node 24.x,
  pnpm and TypeScript 6.x pins; ESM-only; `tsc -b` with project references and no bundler; and the
  F1-owned build/verification command where appropriate.
- **FR-029**: Installation and build MUST succeed when executed inside the canonical development
  environment.

**Commands and verification surface**

- **FR-030**: The workspace MUST expose canonical, discoverable commands sufficient to prove that it
  installs and builds, executable inside the development environment by both humans and agents.
- **FR-031**: After this feature, `bash scripts/dev.sh verify` MUST pass using only verification that
  genuinely exists in F1 and covers at least a reproducible frozen-lock installation and the F1 root
  build. The existing CI mechanism MUST be capable of passing through that same F1-owned verification
  surface without a parallel CI mechanism. Lint, format, unit-test and integration-test stages MUST
  remain unpopulated in F1; the exact command wiring is a planning and implementation decision, not
  frozen by this specification.

**Publication and behaviour boundaries**

- **FR-032**: `@chatter/*` is adopted as the project's package naming convention only. This feature
  MUST NOT assert that ownership of the corresponding registry scope has been verified.
- **FR-033**: Verification of registry scope ownership MUST be recorded as a pre-publication
  requirement. This feature publishes nothing, so it is not gated on that verification.
- **FR-034**: No package may be published and no release automation may be introduced.
- **FR-035**: Library public entry points MUST export zero Chatter domain types, values, functions,
  classes or provider-specific APIs. Provider packages MUST contain zero provider SDK dependencies or
  imports. Applications MUST contain zero routes, UI features, persistence, business logic, provider
  integrations or provider SDK usage. Build-only scaffolding MUST introduce no Chatter Core,
  provider, persistence or application behaviour.

### Key Entities

- **Workspace**: the single unit of dependency resolution and build orchestration for the
  repository. Knows its members; owns the committed dependency lock.
- **Workspace member**: a library package or an application. Carries an identity, a declared minimum
  runtime, a publishability flag, and its declared dependencies. Library packages additionally carry
  independent versions; this feature imposes no independent-version requirement on applications.
- **Dependency edge**: a declared relationship from one workspace member to another. Each edge is
  either permitted by the frozen architecture or forbidden; there is no undeclared edge.
- **Build graph node**: a member's position in the compile ordering, declared explicitly so the
  compile order mirrors the architectural direction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a checkout with no previously installed dependencies, an implementer completes
  installation and a full build using only commands discoverable from the repository, with zero
  undocumented manual steps.
- **SC-002**: The enumerated workspace members match the frozen layout exactly — eight members, none
  missing and none extra.
- **SC-003**: One root build command completes with zero errors across all eight workspace members;
  100% of the six library packages emit type declarations, declaration maps and source maps, and both
  applications compile/build successfully without being required to emit library declarations.
- **SC-004**: 100% of declared internal dependency edges conform to the approved direction; zero
  edges violate it.
- **SC-005**: Every internal dependency edge is explicitly represented in a package manifest and the
  corresponding project-reference graph; the delivered graph contains zero forbidden internal edges;
  and a deliberately introduced undeclared cross-package import fails resolution or compilation. The
  repository returns to a passing install and build after that import is reverted.
- **SC-006**: 100% of library package entry points load successfully under the declared baseline
  runtime without requiring asynchronous module evaluation.
- **SC-007**: Two consecutive verification-context installs from the committed lock resolve an
  identical dependency set, and a verification-context install fails rather than re-resolving or
  modifying the lock when the manifests and committed lock disagree.
- **SC-008**: The declared baseline demonstrably provides native error-cause chaining and Web byte
  streams.
- **SC-009**: Inspection of every library public entry point finds zero exported Chatter domain
  types, values, functions, classes or provider-specific APIs; provider packages contain zero
  provider SDK dependencies/imports; and both applications contain zero routes, UI features,
  persistence, business logic, provider integrations or provider SDK usage.
- **SC-010**: Zero packages are published, and no release automation exists in the repository.
- **SC-011**: Installation and build succeed inside the canonical development environment; results
  obtained outside it are not counted as evidence.
- **SC-012**: From a checkout with no installed dependencies, `bash scripts/dev.sh verify` exits zero
  through the existing verification/CI mechanism using only F1-owned frozen-lock installation and
  root-build verification; no lint, format, unit-test or integration-test stage is falsely populated.
- **SC-013**: `Docs/Tech-Stack.md` factually records the exact Node 24.x, pnpm and TypeScript 6.x pins,
  ESM-only format, `tsc -b` with project references, absence of a bundler, and the materialized F1
  build/verification command where appropriate, without claiming completion of the F2 or F3 records.

## Frozen Constraints

These are not open for decision in this feature. They come from the constitution, the frozen
architecture records, or a recorded human decision.

| Constraint | Source |
|---|---|
| The package/application layout is fixed: `packages/{core,testing,whatsapp,slack,telegram,discord}`, `apps/{validation-server,example-client}`, `bruno/` | `Docs/Architecture/Project-Context.md` §4 |
| `@chatter/core` must not import provider SDKs; no provider SDK type may leak into Core | Constitution Principle IV |
| Provider packages must not depend on one another | `Docs/Architecture/Project-Context.md` §4 |
| No production dependency from any package on `@chatter/testing` | `Docs/Architecture/Implementation-Roadmap.md` §2 |
| Applications consume Chatter as external consumers; the example client must not bypass Chatter; no provider credentials or SDKs in browser code | Constitution Principle XII |
| Language and runtime are Node.js + TypeScript | `Docs/Architecture/Project-Context.md` §1 |
| The baseline must support native `Error.cause` and Web `ReadableStream<Uint8Array>` | `Docs/Architecture/Implementation-Roadmap.md` §2 |
| Independent SemVer per library package | `Docs/Architecture/Project-Context.md` §26 |
| Provider order is WhatsApp → Slack → Telegram → Discord, and this feature implements no provider | Constitution Principle III |
| Bruno is the approved acceptance tool; the first collection belongs to Phase 7 | `Docs/Architecture/Implementation-Roadmap.md` §9, §23 |
| Container-first execution: installs, builds and project commands run in the development container | `AGENTS.md` |
| Stack deviations require human approval and a recorded substitution | Constitution; `Docs/Tech-Stack.md` |

Ratified human decisions carried into this feature (recorded in
`.specify/assessments/phase-0-repository-foundation/feature-planning-brief.md` §16): pnpm as package
manager and workspace mechanism; Node `>=24` with an exact 24.x pin in reproducible surfaces;
an exact pnpm pin selected during planning; TypeScript 6; ESM-only; `tsc -b` with TypeScript project
references and no bundler; no monorepo orchestrator; release automation deferred; boundary enforcement
layered across workspace resolution, project references, lint import constraints and manifest
meta-tests — of which **this feature owns only the workspace-resolution and project-reference
layers**. F1 also owns the narrow factual `Docs/Tech-Stack.md` recording for choices it materializes;
it does not own the comprehensive F3 rewrite.

## Package Boundaries

The dependency direction this feature must establish and must not violate:

```text
apps/*                →  @chatter/core, @chatter/<provider>        (consumers only)
@chatter/<provider>   →  @chatter/core                             (never another provider)
@chatter/core         →  nothing internal, and no provider SDK
@chatter/testing      →  @chatter/core                             (never a production dependency)
```

## Out of Scope / Non-Goals

This feature is the first of three that together deliver Phase 0. It is explicitly **not** the whole
of Phase 0, and it introduces no product behaviour. The following are excluded:

**Chatter behaviour — all of it belongs to Phase 1 and later**

- Chatter Core API behaviour of any kind;
- message normalization;
- conversation semantics implementation;
- capability implementation;
- account lifecycle behaviour;
- error taxonomy implementation;
- outbound sending;
- inbound message handling.

**Provider work — governed by the frozen provider order**

- provider SDK integration;
- WhatsApp adapter behaviour;
- Slack implementation;
- Telegram implementation;
- Discord implementation;
- fake-provider semantics.

**Application and data behaviour**

- persistence of any kind;
- business logic;
- example-client product behaviour;
- Bruno acceptance tests for APIs that do not exist.

**Work belonging to sibling Phase 0 features**

- lint, format and test tooling, and the contract-first test infrastructure — these belong to the
  quality/test tooling feature, except for any minimum bootstrap verification strictly necessary to
  prove this feature is buildable;
- CI and governance implementation — code ownership, licence artifact, branch-protection posture,
  the comprehensive tech-stack record rewrite/removal of remaining Phase 0 placeholders, and the
  acceptance-directory README — these belong to the governance feature. This exclusion does not
  include F1's narrow factual recording of the tooling choices it materializes;
- release automation;
- package publication.

**Never in this feature**

- any change to the constitution, the frozen architecture records, or the workflow mechanism;
- a parallel or replacement development environment;
- a monorepo task orchestrator or build cache;
- a bundler;
- dual-format (ESM + CommonJS) output.

## Assumptions

- **Exact version pins are selected during planning, not here.** The Node 24.x, pnpm and TypeScript
  6.x versions must be confirmed against the then-current releases at implementation time. This
  specification deliberately declines to name them.
- **The acceptance directory is structure, not content.** `bruno/` is created here because it is part
  of the frozen layout; its explanatory README and any content belong to the governance feature and
  to Phase 7 respectively.
- **Buildability is proven by building.** This feature introduces no test runner. Its objective
  evidence is a successful reproducible install, a successful ordered build of all eight members,
  declarations/declaration maps/source maps from all six libraries, an exact workspace-member and
  dependency-edge enumeration, and observed rejection of an undeclared cross-package import.
  Behavioural RED/GREEN tests are not invented for infrastructure that has no behaviour; automated
  declared-edge boundary tests and the contract-first test infrastructure arrive with the
  quality/test tooling feature.
- **Registry scope ownership is unverified.** `@chatter/*` is treated as a naming convention. Nothing
  in this feature depends on holding the registry scope, and nothing here should be read as evidence
  that it is held.
- **Strict link-based dependency layout on the host's mounted filesystem is untested.** If it
  misbehaves, a flatter layout — or relocating installed dependencies into environment-local storage
  — is permitted only through the recorded stack-substitution procedure, and does not change the
  required outcome.
- **A single maintainer is the near-term reality.** No requirement here depends on a second reviewer.
- **The existing verification and CI mechanism is used as-is.** This feature does not add or fork a
  CI framework; CI already executes verification inside the same development environment.

## Dependencies

- The existing development container, its verification entry point, and the existing CI job — used
  as-is, extended only at the image's sanctioned extension point.
- A working container runtime on the developer's machine, and network access at image build time to
  provision the language runtime and package manager.
- The recorded stack-substitution procedure in `Docs/Tech-Stack.md`, which is the only route for
  changing a ratified tooling choice.
- No dependency on any other roadmap phase. This feature is the root of the dependency graph; the
  quality/test tooling feature depends on it, and Phase 1 depends on both.
