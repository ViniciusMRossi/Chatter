# Data Model: Repository / Workspace Foundation

**Feature**: `001-repository-workspace-foundation` | **Date**: 2026-08-31

F1 introduces **no runtime data model** — no entities, no persistence, no serialization. The Chatter
domain model (refs, conversations, messages, capabilities, errors) belongs to Phase 1 and is
explicitly out of scope.

What F1 *does* define is a **repository metadata model**: the structural facts that make the
workspace real and that the acceptance criteria are stated against. This document specifies that
model so it can be inspected and, in F2, asserted mechanically.

---

## Entity: Workspace

The single unit of dependency resolution and build orchestration.

| Field | Value in F1 | Source of truth | Requirement |
|---|---|---|---|
| members | exactly eight (see below); the workspace **root project is not a member** | `pnpm-workspace.yaml` `packages:` globs | FR-001, SC-002 |
| root identity | `name: "chatter"`, `private: true` | root `package.json` | enumeration determinism (D2) |
| settings | `pmOnFail: error`, `engineStrict: true`, `nodeLinker: isolated` | `pnpm-workspace.yaml` | FR-025, FR-026 |
| dependency lock | committed | `pnpm-lock.yaml` | FR-026 |
| package manager | `pnpm@11.24.0` | root `package.json` `packageManager` | FR-027 |
| root scripts | `build`, `clean`, `verify` | root `package.json` | FR-030 |
| build entry | solution `tsconfig.json`, `files: []` + eight references | root `tsconfig.json` | FR-014, FR-017 |

**Validation rules**

- The member set must equal the frozen layout — no missing member, no extra member.
- `bruno/` is inside the repository but is **not** a member; it is a reserved acceptance-collection
  directory and must contain no collections in F1 (FR-006).
- The root manifest is `private: true` and is not itself a publishable package.
- **The workspace root is a pnpm project but not a member.** pnpm's recursive `list` reports every
  workspace project *including the root*, so its raw output has nine entries, not eight. (The
  root-exclusion behaviour of `exec`, `run`, `test` and `add` does not apply to `list`.) Any
  membership check must discriminate the root by its **path** — comparing it against the workspace
  root — and then compare the remaining sorted name and path sets against the expected eight. A bare
  count is not a valid check.

---

## Entity: Workspace member

A member is either a **library package** or an **application**. The two roles differ in exactly four
fields, and nowhere else.

### Shared fields

| Field | Rule | Requirement |
|---|---|---|
| `name` | unique across the workspace | FR-003, FR-004 |
| `type` | `"module"` — ESM only | FR-012 |
| `engines.node` | `">=24.0.0"` | FR-007 |
| entry module | one file, content `export {};` | FR-013, FR-035 |
| TypeScript project | extends `tsconfig.base.json`; sets `rootDir` and `outDir` | FR-011 |
| `composite` | `true` (required by `tsc -b`) | FR-014 |
| build output | ignored by version control | FR-018 |

### Role differences

| Field | Library package | Application | Requirement |
|---|---|---|---|
| name shape | `@chatter/<name>` | unscoped (`chatter-<name>`) | FR-003, FR-032 |
| `version` | present, independent (`0.0.0`) | absent (fallback `"0.0.0"` only if the toolchain demands it) | FR-005 |
| `private` | absent | `true` | FR-004 |
| `exports` | `{ ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }` | absent | FR-015 |

### Member instances

| Member | Role | Name | Declares |
|---|---|---|---|
| `packages/core` | library | `@chatter/core` | nothing |
| `packages/testing` | library | `@chatter/testing` | `@chatter/core` |
| `packages/whatsapp` | library | `@chatter/whatsapp` | `@chatter/core` |
| `packages/slack` | library | `@chatter/slack` | `@chatter/core` |
| `packages/telegram` | library | `@chatter/telegram` | `@chatter/core` |
| `packages/discord` | library | `@chatter/discord` | `@chatter/core` |
| `apps/validation-server` | application | `chatter-validation-server` | `@chatter/core` |
| `apps/example-client` | application | `chatter-example-client` | `@chatter/core` |

**Validation rules**

- A member's public surface exports **zero** Chatter domain types, values, functions or classes.
- No member declares a provider SDK.
- `@chatter/core` declares no internal dependency and holds no project reference.
- **Loadability (libraries only).** After the build, a library's public entry point must load
  successfully when resolved **by package name** through its own `exports` map, and must load
  **synchronously** — a graph requiring asynchronous evaluation is a defect, not a variation. This is
  a property of the *built* package, so it cannot be established by reading `src/`; it is verified
  executably (see `plan.md` D13 `P-LOAD`). Applications are excluded: they declare no `exports` map
  and are not consumable packages.

---

## Entity: Dependency edge

A declared relationship from one member to another. Every edge exists in **two places at once** and
they must agree:

1. the depending member's `package.json` `dependencies`, using the `workspace:*` protocol;
2. the depending member's `tsconfig.json` `references` array.

An edge present in one and absent from the other is a defect. Requiring both is what makes an
architecturally wrong edge a visible, deliberate two-file change (FR-017, FR-024).

### Permitted edge types

| From | To | Permitted | Requirement |
|---|---|---|---|
| provider package | `@chatter/core` | yes | FR-019 |
| provider package | another provider package | **no** | FR-020 |
| `@chatter/core` | anything internal | **no** | FR-019 |
| `@chatter/core` | a provider SDK | **no** | FR-019 |
| `@chatter/testing` | `@chatter/core` | yes | Package Boundaries |
| any member | `@chatter/testing` as a production dependency | **no** | FR-021 |
| application | Chatter package | yes | FR-022 |
| application | provider SDK | **no** | FR-022, FR-023 |

### Delivered edge set

Seven edges, all of the form `<member> → @chatter/core`, from every member except `core` itself.
Zero forbidden edges; zero edges to `@chatter/testing`.

**Validation rules**

- Every edge is explicit — there is no undeclared edge (FR-025). An import of a workspace package
  that is not declared must fail to resolve or compile.
- The edge set contains no cycle.

---

## Entity: Build graph node

A member's position in the compile ordering, derived entirely from the reference graph.

The delivered graph has **two levels**, not three.

| Level | Members | Depends on |
|---|---|---|
| 0 | `packages/core` | — |
| 1 | `packages/{testing,whatsapp,slack,telegram,discord}` **and** `apps/{validation-server,example-client}` | level 0 |

All seven level-1 members are **direct** dependants of `@chatter/core` and are mutually independent.
The applications are **not** downstream of `packages/testing` or of the provider packages: they
declare `@chatter/core` and nothing else, so nothing orders them relative to the other libraries.
`tsc -b` may build the seven in any order.

`tsc -b` derives this order from `references`; it is not written down anywhere as a list. When the
ordering itself needs to be observed, `tsc -b --verbose` reports it without changing the canonical
build.

**Emitted artefacts per member**

| Artefact | Libraries | Applications |
|---|---|---|
| `dist/index.js` / `dist/main.js` | required | required |
| `dist/*.js.map` | required | produced |
| `dist/*.d.ts` | **required** (consumability contract) | produced as build state only |
| `dist/*.d.ts.map` | **required** | produced as build state only |
| `*.tsbuildinfo` | build state, git-ignored | build state, git-ignored |

Application declaration output is a consequence of `composite: true`, which `tsc -b` requires. It
carries no consumability meaning: applications are private and expose no `exports` map. See
`plan.md` → Complexity Tracking.

---

## State transitions

The repository has three observable states, and F1 exists to move it from the first to the third.

```text
unbuildable                    → installed                     → built
(no workspace, no toolchain)     (frozen-lock install done)      (tsc -b complete)
```

| Transition | Trigger | Failure behaviour |
|---|---|---|
| unbuildable → installed | `pnpm install --frozen-lockfile` in the container | fails if the lock and manifests disagree; fails if Node does not satisfy `engines` (`engineStrict`); fails if the running pnpm differs from `packageManager` (`pmOnFail: error`) |
| installed → built | `pnpm run build` | fails on any type error, on a missing project reference, or on an undeclared cross-package import |
| built → unbuildable | `pnpm run clean` | resets build state only; the lock and manifests are untouched |

There is no other state. F1 introduces no runtime, no process lifecycle and nothing that can be
"running".
