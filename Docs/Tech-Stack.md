# Tech Stack

Operational record of Chatter's approved implementation tools and the process for changing them.

This file is the workflow layer's source for *approved tooling*. It does not define product
architecture. Architectural constraints live under [`Architecture/`](Architecture/) and are
routed by the canonical constitution at
[`.specify/memory/constitution.md`](../.specify/memory/constitution.md). Where this file records a
choice, the architectural *reason* for that choice stays in the architecture record it cites.

Entries marked **Phase 0 decision** are deliberately unset. The frozen architecture does not fix
them, so they must be decided and recorded during Roadmap Phase 0 rather than assumed here. See
[`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) §2.

## Approved stack

- **Language/runtime:** Node.js + TypeScript. Engine range `>=24.0.0` declared by the root manifest
  and by every workspace member; the development image and CI pin Node **24.20.0** exactly. TypeScript
  is pinned to **6.0.3** as the single root devDependency. The shared `tsconfig.base.json` targets
  `ES2024` with `module`/`moduleResolution` `nodenext`, and states every option whose default changes
  in TypeScript 7 explicitly (plus `stableTypeOrdering`) so that migration stays mechanical.
  *(Recorded by F1 — Repository / Workspace Foundation.)*
- **Package/dependency manager:** **pnpm 11.24.0**, provisioned in the development image and
  declared in the root `packageManager` field. Workspace members are declared in
  `pnpm-workspace.yaml` (`packages/*`, `apps/*`), which also carries the pnpm settings — pnpm 11 reads
  settings from that file and treats `.npmrc` as auth/registry only, so no `.npmrc` exists. Internal
  dependencies use the `workspace:*` protocol. Settings: `nodeLinker: isolated`, `pmOnFail: error`,
  `engineStrict: true`. *(Recorded by F1.)*
- **Framework/library baseline:** none for `@chatter/core`. Core is framework-neutral and carries
  no HTTP framework dependency — no Express/Fastify in Core
  ([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §20). Provider SDKs are
  listed under [Provider SDK strategy](#provider-sdk-strategy).
- **Module format and build tooling:** **ESM-only** — every workspace member, library and
  application alike, declares `"type": "module"`, and no CommonJS artifact is produced or published.
  Only the six library packages expose a public entry point, via a `types`-before-`default` `exports`
  map; the two applications intentionally expose **no** `exports` map, because they are private and
  are not consumed as packages. Built with the TypeScript compiler alone (`tsc -b`) over **TypeScript
  project references**; **no bundler**, and no monorepo task orchestrator. *(Recorded by F1.)*
- **Unit-test framework:** **Phase 0 decision**. Chatter's reusable contract suites live in
  `packages/testing` and must be runnable by whichever runner Phase 0 selects.
- **Integration-test framework:** **Phase 0 decision** for the runner. **Bruno** is the approved
  tool for credential-free and provider acceptance collections
  ([`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) §9, §23).
- **UI/E2E tooling (if any):** **Phase 0 or later decision**. Example-client E2E is expected only
  "where justified" ([`Adoption/Integration-Guide.md`](Adoption/Integration-Guide.md) §6).
- **Build command:** `pnpm run build` (`tsc -b` over the root solution project). *(Recorded by F1.)*
- **Lint command:** **Phase 0 decision.**
- **Typecheck command:** **Phase 0 decision.**
- **Unit test command:** **Phase 0 decision.**
- **Integration test command:** **Phase 0 decision.**
- **Full verification command (optional):** `pnpm install --frozen-lockfile && pnpm run verify`,
  mirrored in `.sdd/commands.env` as `SDD_FULL_VERIFY_COMMAND`. `scripts/verify.sh` short-circuits on
  this variable, so the granular build/lint/typecheck/unit/integration variables are deliberately left
  empty until F2 populates them. *(Recorded by F1.)*

Mirror executable verification commands in `.sdd/commands.env` once they exist. Extend the
workflow layer's CI baseline with Chatter contract, Bruno, provider, and E2E jobs rather than
building a parallel CI framework.

## Runtime and language

Chatter is a Node.js + TypeScript library
([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §1).

Constraints that Phase 0's version choices MUST satisfy
([`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) §2):

- the TypeScript target/lib baseline must support native `Error.cause`, which the error contract
  relies on instead of a competing `cause` field;
- the baseline must support Web `ReadableStream<Uint8Array>`, required by `MediaContent`;
- Node engine requirements are declared per package.

Package versioning is independent SemVer per package
([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §26,
[`Architecture/Implementation-Roadmap.md`](Architecture/Implementation-Roadmap.md) §28). Provider
`native` values and entity `raw` payload contents are explicit compatibility exclusions.

No specific Node version, TypeScript version, package manager, test runner, linter, or build tool
is fixed by any authoritative Chatter record. Do not infer one from this file.

## Repository architecture

Planned monorepo layout
([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §4,
[`Adoption/Integration-Guide.md`](Adoption/Integration-Guide.md) §5):

```text
packages/core
packages/testing
packages/whatsapp
packages/slack
packages/telegram
packages/discord

apps/validation-server
apps/example-client

bruno
Docs
```

Dependency boundaries that are architectural, not tooling preferences:

- `@chatter/core` MUST NOT import provider SDKs (constitution Principle IV).
- Provider packages MUST NOT depend on each other.
- Provider packages MUST NOT take a production dependency on `@chatter/testing`.
- `apps/validation-server` and `apps/example-client` consume Chatter as external applications and
  MUST NOT import provider SDKs directly.

Exact workspace mechanics — package manager, workspace protocol, build orchestration, per-package
`package.json` shape — are Phase 0 implementation decisions and are not frozen elsewhere.

## Provider SDK strategy

Intended initial implementations
([`Architecture/Project-Context.md`](Architecture/Project-Context.md) §5):

| Provider | Intended SDK |
|---|---|
| WhatsApp | `meta-cloud-api`, behind an internal `WhatsAppDriver` |
| Slack | `@slack/bolt` + `@slack/web-api` |
| Telegram | `grammy` |
| Discord | `discord.js` |

The WhatsApp stack is deliberately layered:

```text
WhatsAppAdapter → WhatsAppDriver → MetaCloudApiDriver → meta-cloud-api
```

Qualifications that MUST be preserved:

- These are **intended initial driver implementation choices, not permanent public dependency
  contracts.**
- They are implementation details behind Chatter's provider boundaries.
- Provider SDK types MUST NOT leak into `@chatter/core`.
- Changing an internal provider SDK MUST NOT require a breaking Chatter API change unless the
  Chatter contract itself changes.

Adopting a provider SDK does not authorize implementing that provider. Provider order and
depth-first delivery are governed by constitution Principle III.

## Outside-stack substitutions

An agent MUST NOT silently substitute a major library, framework, provider SDK, service, or
architectural mechanism outside the approved stack recorded here.

If a substitution becomes necessary:

1. identify the proposed change;
2. explain why the approved choice is insufficient;
3. identify the affected architecture record or feature;
4. obtain human approval before implementation;
5. update the appropriate authoritative record — this file for a tooling choice, the relevant
   `Architecture/` record when the change touches a contract, and the constitution when it touches
   a governed rule;
6. append a row to the [substitution log](#substitution-log).

Adding an ordinary, non-load-bearing utility dependency inside an already-approved boundary is
normal feature work and does not require this procedure. Replacing a driver, runtime, test
framework, workspace mechanism, or provider SDK does.

## Relationship to SpecMan and the architecture records

- **SpecMan and the pinned Spec Kit own the development workflow mechanism** — artifact lifecycle,
  commands, TDD evidence, Git/PR process, verification, handoff, and the development container.
  This file does not restate or fork those mechanics.
- **This file owns Chatter's approved operational tool choices** and the substitution procedure.
- **Architectural constraints continue to live under [`Architecture/`](Architecture/)** and are
  routed by the constitution's *Authoritative Project Records* section. This file cites them; it
  does not replace or restate them.
- If this file appears to conflict with the constitution or a frozen architecture record, that
  conflict requires **human resolution**. This file does not silently take precedence, and an
  unset or template value here is never permission to override accepted Chatter architecture.

## Substitution log

| Date | Existing approved tool | Proposed substitute | Rationale | Human approval |
|---|---|---|---|---|
| | | | | |
