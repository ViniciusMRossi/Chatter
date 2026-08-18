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
- Linting/formatting: ESLint (`typescript-eslint` strict + stylistic configs) + Prettier.
  Decided during Phase 1 tooling setup: ESLint's type-aware rules catch more real bugs in a
  strict-TS library than Biome's current TS support, and both tools are the most widely
  understood default for TS library maintainers reviewing this code later.
- E2E/UI testing: Magnitude (https://github.com/magnitudedev/browser-agent) — Apache-2.0,
  vision-first, has its own test runner + CI integration. Not expected to apply to Chatter
  itself (no UI), but available for example applications built on top of it.
- First provider adapter (Phase 2 vertical slice): Telegram — simplest bot model, no app-review
  gate, supports both direct and group conversations, per roadmap recommendation.
- Telegram transport: webhook (not long polling). More production-realistic and exercises
  FR-016's framework-independent webhook handler contract and NFR-004's signature/secret
  validation requirement for this first real-network adapter. Requires a public HTTPS URL
  (tunnel/ngrok) for local development against Telegram's real servers; the adapter conformance
  suite and unit tests still require none.
- Telegram SDK: grammY (https://grammy.dev) — Apache-2.0, TypeScript-native with strong typings
  out of the box, actively maintained, ships its own framework-neutral webhook callback helpers
  (reduces custom work for FR-016 compliance). Preferred over Telegraf's middleware-chain
  abstraction (impedance mismatch with Chatter's own adapter contract) and over a raw
  fetch-based Bot API client (would mean reimplementing typed responses and retry handling).
- API documentation: Bruno (https://www.usebruno.com/) — OpenCollection YAML format (Bruno's
  current recommendation for new collections over legacy `.bru`), plain text and git-friendly.
  Required for every HTTP-facing endpoint a ticket adds or changes: a provider adapter's
  outbound calls to the provider's API, and any inbound webhook endpoint. Collections live at
  `bruno/<provider>-adapter/`, one per provider adapter; see `bruno/README.md` for the layout
  and secret-handling convention (secret-flagged variables, blank in the committed environment
  file — never a real token/secret in git).
- API contract testing: every Bruno request carries a `tests` block (Bruno's own Chai-based
  assertion runtime) and, for endpoints that don't need a real provider credential (e.g. a
  webhook handler under our own control), runs automatically in CI via the Bruno CLI
  (`@usebruno/cli`, devDependency of the owning package) against a throwaway stub-backed test
  server — zero real credentials, same rule as every other automated test in this project. See
  `packages/telegram/tests/bruno/` for the reference implementation.
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
