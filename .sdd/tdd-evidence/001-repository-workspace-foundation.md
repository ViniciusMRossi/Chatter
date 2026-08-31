# TDD Evidence: 001-repository-workspace-foundation

## SKIP — 2026-08-31 18:56 UTC

**Rationale:** F1 changes no behaviour: every one of the eight workspace members is a build-only scaffold whose entry module is exactly 'export {};'. A behavioural RED is not practical and must not be manufactured for an empty module (plan.md Constitution Check, principle XIV; spec.md Assumptions). The contract-first harness and all test tooling belong to F2. One genuine observed-failure/observed-pass cycle IS recorded below from P-UNDECLARED (task T032), because it is real rather than ceremonial.

## RED — 2026-08-31 18:56 UTC

**Command:** `pnpm run build (with an undeclared import of @chatter/telegram added to packages/slack/src/index.ts)`

**Observed result:** FAILED as required, exit 1: packages/slack/src/index.ts(1,8): error TS2882: Cannot find module or type declarations for side-effect import of '@chatter/telegram'. Proves FR-025/SC-005: a package cannot use a workspace dependency it has not declared.

## GREEN — 2026-08-31 18:56 UTC

**Command:** `pnpm install --frozen-lockfile && pnpm run build (after restoring packages/slack/src/index.ts byte-identically)`

**Observed result:** PASSED, exit 0: all eight members build and the entry module is byte-identical to the canonical 'export {};' file. No residual state.

