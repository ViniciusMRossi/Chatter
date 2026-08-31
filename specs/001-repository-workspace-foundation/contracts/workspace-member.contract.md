# Contract: Workspace Member

**Feature**: `001-repository-workspace-foundation` | **Date**: 2026-08-31

F1 exposes no runtime API. The one interface it *does* define is structural: the shape every
workspace member must have for the workspace to resolve, the build graph to be valid, and the frozen
boundaries to hold.

This contract is written to be checkable, and F1 checks most of it with **fail-closed acceptance
probes** rather than by reading:

| Clause | How F1 verifies it |
|---|---|
| C1.1–C1.2, C2.1–C2.2, C3.1–C3.2 (manifest and project shape) | asserted — `plan.md` D13 `P-MANIFESTS` (field-by-field, data-driven) and `P-MEMBERS` (membership and paths) |
| C1.3 (entry module content) | asserted — D13 `P-ZERO`, by `cmp` against a canonical file |
| C2.3 (build output) | asserted — D13 `P-BUILD` |
| C2.4 (empty entry surface) | asserted at runtime by D13 `P-LOAD`; the emitted `.d.ts` text is additionally read by a human |
| C2.5 (loadability) | asserted — D13 `P-LOAD`, by actually loading the built packages, because a property of emitted output cannot be established by reading source |
| C4.1–C4.4 (edges) | asserted — D13 `P-EDGES` compares the derived edge set from manifests *and* from project references against one expected list, and asserts every internal dependency value is exactly `workspace:*`; D13 `P-UNDECLARED` exercises C4.4 |
| C5 (workspace level) | asserted — D13 `P-MEMBERS`, `P-LOCK`, `P-MANIFESTS` (root fields) and `P-VERIFY` |

These are one-off acceptance commands, not a checked-in suite. **F2's manifest boundary meta-tests
are expected to assert the whole contract mechanically and continuously**, including the one thing F1
deliberately does not automate: rejection of a deliberately *declared* forbidden edge (C4.3). Writing
the contract down now is what lets F2 assert an agreed contract instead of inventing one.

---

## C1 — Every member

A member is a directory under `packages/` or `apps/` containing:

```text
<member>/
├── package.json
├── tsconfig.json
└── src/<entry>.ts
```

### C1.1 Manifest

MUST declare:

| Field | Constraint |
|---|---|
| `name` | non-empty, unique in the workspace |
| `type` | exactly `"module"` |
| `engines.node` | `">=24.0.0"` |

MUST NOT declare:

- `main`, `module` or `browser` — ESM consumers resolve through `exports` (libraries) or not at all
  (applications);
- `publishConfig`, `prepublishOnly`, `prepack` or any publish-adjacent script;
- any provider SDK in `dependencies`, `devDependencies` or `peerDependencies`;
- `@chatter/testing` in `dependencies`.

### C1.2 TypeScript project

MUST:

- `extends` the root `tsconfig.base.json`;
- set `compilerOptions.rootDir` to `"./src"` and `compilerOptions.outDir` to `"./dist"` — these are
  per-project because relative paths in an extended config resolve against the base file's directory;
- inherit `composite: true` from the base (required by `tsc -b` for any referenced project);
- list a `references` entry for **every** internal dependency in its manifest, and for none other.

### C1.3 Entry module

MUST consist of exactly the following, including the trailing newline — the canonical entry module
is byte-defined, so it can be verified with `cmp` rather than a whitespace-stripping comparison:

```ts
export {};
```

MUST NOT contain: any export of a value, type, class, function or namespace; any import; any
top-level await; any side effect.

This is the literal satisfaction of FR-035 and FR-013 — a valid ES module with an empty public
surface and a synchronously loadable graph.

---

## C2 — Library packages

Applies to `@chatter/core`, `@chatter/testing`, `@chatter/whatsapp`, `@chatter/slack`,
`@chatter/telegram`, `@chatter/discord`.

### C2.1 Identity

- `name` MUST be `@chatter/<dirname>`.
- `version` MUST be present and independently maintained. **In F1 it is exactly `0.0.0` for all
  six** — nothing has been released, so the value is fixed and asserted exactly rather than matched
  against a SemVer shape.
- `private` MUST be absent — libraries are conceptually publishable, even though F1 publishes
  nothing and asserts no registry rights.

### C2.2 Entry point contract

MUST declare exactly:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

- The `types` condition MUST come first — condition order is significant, and TypeScript's `nodenext`
  resolution reads it before `default`.
- No subpath export is declared. Deep imports into a Chatter package are not part of the contract;
  a package that later needs a subpath adds it deliberately.

### C2.3 Build output

A library build MUST produce, for its entry:

| Artefact | Purpose |
|---|---|
| `dist/index.js` | the ESM entry |
| `dist/index.js.map` | source map |
| `dist/index.d.ts` | the type surface, referenced by the `types` condition |
| `dist/index.d.ts.map` | declaration map |

A library that builds without emitting declarations does not satisfy this contract (FR-015, SC-003).

### C2.4 Entry surface

The emitted `dist/index.d.ts` MUST export nothing. This is the machine-checkable form of "zero
Chatter behaviour" (SC-009).

### C2.5 Loadability

The **built** entry point MUST load, and MUST load synchronously.

| Requirement | Constraint |
|---|---|
| Resolution | MUST resolve **by package name** (`@chatter/<name>`) through the package's own `exports` map — self-reference resolution, not a file path. A package whose `exports` map is wrong fails here even though it compiled. |
| Synchronous evaluation | MUST be loadable by `require()` under the pinned Node baseline. Node throws `ERR_REQUIRE_ASYNC_MODULE` when an ES module graph needs asynchronous evaluation, so an entry graph that acquires top-level await fails this clause automatically. |
| Result | The loaded module namespace MUST have zero own enumerable keys, which is C2.4 asserted at runtime rather than in the declaration text. |

**Scope.** This clause constrains **Chatter's own entry graphs**. Per FR-013 it is not, and must not
be presented as, a promise of universal legacy CommonJS compatibility for arbitrary consumers.

**Why it is not "by construction".** Absence of `await` in `src/` proves nothing about the emitted
package: the build could emit invalid output, the `exports` map could point at a path that does not
exist, or the declared conditions could be ordered wrongly. C2.5 is therefore verified by executing
a load against `dist/`, after the build (`plan.md` D13 `P-LOAD`; `quickstart.md` Scenario 7).

Applications are **out of scope** for this clause — they declare no `exports` map (C3.2) and are not
consumable packages.

---

## C3 — Applications

Applies to `apps/validation-server` and `apps/example-client`.

### C3.1 Identity

- `name` MUST be unscoped (`chatter-validation-server`, `chatter-example-client`). Using the
  `@chatter/*` scope for something that will never be published would misrepresent the naming
  convention.
- `private` MUST be `true` (FR-004).
- `version` is NOT required. If the toolchain demands one, `"0.0.0"` is the permitted fallback —
  it satisfies the tool while asserting no versioning intent.

### C3.2 No consumable surface

- MUST NOT declare an `exports` map. An application is not a package anyone imports.
- Declaration output produced because `composite: true` is build state, not a contract. Nothing may
  depend on an application's `.d.ts`.

### C3.3 Boundary

- MAY depend on Chatter packages.
- MUST NOT depend on a provider SDK, directly or transitively through a declared dependency
  (FR-022, FR-023).
- MUST NOT contain routes, UI, persistence, business logic or provider integration (FR-035).

---

## C4 — Dependency edges

### C4.1 Dual declaration

Every internal edge MUST appear in **both**:

1. `package.json` → `dependencies` → `"@chatter/<name>": "workspace:*"`;
2. `tsconfig.json` → `references` → `{ "path": "<relative path to that member>" }`.

An edge in only one of the two is a defect. The redundancy is intentional: it makes an
architecturally wrong edge a two-file, visibly deliberate change (FR-017).

### C4.2 Permitted directions

```text
apps/*                →  @chatter/core, @chatter/<provider>     (consumers only)
@chatter/<provider>   →  @chatter/core                          (never another provider)
@chatter/core         →  nothing internal, and no provider SDK
@chatter/testing      →  @chatter/core                          (never a production dependency)
```

### C4.3 Forbidden, and how each is prevented in F1

| Forbidden edge | F1 mechanism | F2 mechanism |
|---|---|---|
| provider → provider (undeclared import) | isolated `node_modules`: the package is not resolvable | ESLint import restriction |
| provider → provider (declared) | not declared; visible in review | manifest meta-test |
| core → provider | not declared; core has no references | manifest meta-test |
| core → provider SDK | core declares no dependency at all | ESLint + manifest meta-test |
| `@chatter/testing` as a production dependency | no member declares it | manifest meta-test |
| application → provider SDK | no application declares one | ESLint + manifest meta-test |

F1 owns the first row's mechanism and delivers a conforming graph for the rest. **Automated rejection
of a deliberately *declared* forbidden edge is F2's, not F1's** — the spec assigns it there and this
contract must not be read as pulling it forward.

### C4.4 Undeclared-import behaviour

Given a member that imports a workspace package it does not declare, the build MUST fail — either
because the module does not resolve under the isolated layout, or because TypeScript cannot find a
project reference for it.

Reference probe (documented in `quickstart.md`): add `import '@chatter/telegram';` to
`packages/slack/src/index.ts`, an edge `slack` does not declare, and observe the failure.

---

## C5 — Workspace-level contract

| Rule | Constraint |
|---|---|
| Membership | `pnpm-workspace.yaml` `packages:` resolves to exactly the eight members; `bruno/` is excluded. The **workspace root is a pnpm project but not a member**: it appears in recursive `list` output (root exclusion applies to `exec`/`run`/`test`/`add`, not `list`), so a membership check MUST discriminate it by path and compare sorted name and path sets — never by count |
| Root identity | root `package.json` declares `name: "chatter"` and `private: true`, so the root is identifiable in raw workspace output |
| Settings location | pnpm settings live in `pnpm-workspace.yaml`; **no `.npmrc` is created** — in pnpm 11 it is read for auth/registry only, so settings placed there would be silently ignored |
| Lock | `pnpm-lock.yaml` is committed; verification installs use `--frozen-lockfile` |
| Package manager | root `packageManager` is `pnpm@11.24.0`, enforced by `pmOnFail: error` |
| Runtime | `engineStrict: true` makes an unsatisfied `engines.node` an install failure |
| Supply-chain policy | `pnpm-workspace.yaml` MUST declare `blockExoticSubdeps: true`, `minimumReleaseAge: 10080` and `trustPolicy: no-downgrade`, and MUST NOT declare any exception key (`minimumReleaseAgeExclude`, `trustPolicyExclude`, `trustPolicyIgnoreAfter`, `trustLockfile`). Adopted after PR #1 as a Tier 1 (Semgrep) correction |
| Solution project | root `tsconfig.json` has `files: []` and references all eight members |
| Root scripts | `build`, `clean`, `verify` — and `verify` claims no stage F1 does not provide |
