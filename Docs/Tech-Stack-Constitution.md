# Tech Stack Constitution

This is the authoritative source for stack and architecture decisions. Agents must not deviate
from what's documented here without first asking permission — and if the standard tool/approach
doesn't fit, they must propose an alternative and log it below **before** using it, not after.

## Approved stack

- Language(s): TypeScript (strict mode), compiled to ESM-only JavaScript output.
- Runtime: Node.js, active LTS versions only. Minimum version pinned in each package's
  `engines` field and enforced in CI; bump the floor as LTS versions age out.
- Module format: ESM only (`"type": "module"`, `.mjs`/`.ts` with `moduleResolution: bundler`
  or `NodeNext`). No CommonJS build target — consumers must be ESM-compatible.
- Monorepo/package manager: pnpm workspaces. Chosen for strict dependency isolation (each
  `@chatter/*` package only sees deps it explicitly declares — catches accidental cross-package
  imports early, important since adapters must stay independently installable per NFR-003) and
  fast installs. No Turborepo/Nx yet — add only if build/task orchestration pain justifies it.
- Package structure: `@chatter/core`, `@chatter/testing`, `@chatter/slack`, `@chatter/discord`,
  `@chatter/telegram`, `@chatter/whatsapp` as independent, independently-publishable packages in
  one pnpm workspace. Final npm scope TBD (see Open Decisions in the roadmap doc).
- Framework(s): none — Chatter is a library, not an application framework. Webhook adapters
  expose framework-independent handlers per FR-016; no Express/Fastify dependency in core.
- Unit/integration testing: Vitest. Chosen for native ESM/TS support with no transpilation
  config, consistent with the ESM-only decision above.
- Linting/formatting: TBD — propose ESLint + Prettier (or Biome as a single-tool alternative)
  when Phase 1 tooling setup begins; log the actual choice here once decided.
- E2E/UI testing: Magnitude (https://github.com/magnitudedev/browser-agent) — Apache-2.0,
  vision-first, has its own test runner + CI integration. Not expected to apply to Chatter
  itself (no UI), but available for example applications built on top of it.
- First provider adapter (Phase 2 vertical slice): Telegram — simplest bot model, no app-review
  gate, supports both direct and group conversations, per roadmap recommendation.
- Tier 1 security (every PR, automated): Semgrep + gitleaks
- Tier 2 security (major releases, manual trigger only): Shannon
  (https://github.com/KeygraphHQ/shannon) — whitebox, requires source access, ~$40-55/run in
  API credits, human-triggered only per Security Engineer recommendation

## Tool substitution log

When a standard tool above doesn't fit a given situation, record it here before using the
alternative:

| Date | Ticket | Standard tool | Substituted with | Rationale | Approved by |
|------|--------|---------------|-------------------|-----------|-------------|
|      |        |               |                   |           |             |
