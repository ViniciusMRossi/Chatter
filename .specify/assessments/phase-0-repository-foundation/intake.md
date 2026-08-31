# Idea Intake: Phase 0 — Chatter Repository Foundation

- **Slug**: phase-0-repository-foundation
- **Created**: 2026-08-30
- **Source**: pasted text (human request) + repo pointer (`Docs/Architecture/Implementation-Roadmap.md` §2, `Docs/Adoption/Adoption-Checklist.md` "Phase 0")
- **Type**: new-capability

## Idea (as captured)

> Begin planning **Phase 0: Chatter Repository Foundation**.
>
> The outcome of Phase 0 is to establish the buildable, testable, maintainable monorepo foundation
> required before implementation of Chatter Core.

The repository's own frozen roadmap states the same milestone:

> Create/validate the Chatter-owned repository structure … Decide and document: package manager and
> workspace configuration; TypeScript target/lib baseline, including native `Error.cause` and Web
> `ReadableStream<Uint8Array>` support required by `MediaContent`; package build/test/lint/typecheck
> commands; independent package versioning; per-package Node engine requirements; workspace
> boundaries; no production dependency from provider packages to `@chatter/testing`.
> Deliverable: a buildable empty Chatter monorepo whose project-specific verification runs
> successfully through the SpecMan verification surface.
> — `Docs/Architecture/Implementation-Roadmap.md` §2

## Restated

Establish the empty-but-buildable Chatter monorepo: workspace and package layout, language/runtime
baseline, build/lint/typecheck/test toolchain, enforced package boundaries, and the canonical
verification commands wired into SpecMan — without implementing any Chatter Core or provider
behaviour.

## Origin & Context

- **Raised by**: the human maintainer (repository owner), following ratification of Chatter
  Constitution v1.0.0 and completion of the SpecMan adoption baseline (`83a7d11`).
- **Trigger**: adoption is complete and the Adoption Checklist's "Phase 0" section is the next
  open block of work. The roadmap makes Phase 0 the precondition for Phase 1 (Core public model
  and Adapter SPI).

## First-Glance Unknowns

- [NEEDS CLARIFICATION: package manager — the architecture explicitly leaves this to Phase 0.]
- [NEEDS CLARIFICATION: Node engine range and TypeScript version strategy.]
- [NEEDS CLARIFICATION: module publishing model — ESM-only vs dual ESM/CJS.]
- [NEEDS CLARIFICATION: npm scope ownership for `@chatter/*` — is the scope available/owned?]
- [NEEDS CLARIFICATION: LICENSE choice — human/business decision, still open in the checklist.]
- [NEEDS CLARIFICATION: CODEOWNERS identity and whether "require approvals" is workable with a
  single maintainer.]
- [NEEDS CLARIFICATION: whether Phase 0 is one feature or several independently verifiable ones.]
