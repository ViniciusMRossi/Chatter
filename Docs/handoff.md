# Handoff

_Updated: 2026-08-31 19:46 UTC | harness: claude-code | reason: feature-progress_

## Current work
- Feature/spec: 001-repository-workspace-foundation
- Tracking issue: unspecified
- Branch: 001-repository-workspace-foundation
- PR: none

## Summary
F1 Repository / Workspace Foundation: tasks T001-T040 complete, plus an authorized narrow correction to P-VERIFY (commit aa1f3f6). The dev image provisions pinned Node 24.20.0 (checksum-verified) and pnpm 11.24.0 in /usr/local; the frozen eight-member pnpm workspace builds with a single 'tsc -b'; the six libraries emit .js/.js.map/.d.ts/.d.ts.map; 'bash scripts/dev.sh verify' exits 0 from a genuinely cold checkout. All 16 D13 probes pass. Zero Chatter behaviour, zero provider SDKs, zero F2/F3 scope. T041 (PR) not executed; nothing pushed.

## Next step
Codex re-review of the correction, then T041: open the PR on 001-repository-workspace-foundation, let quality.yml and Tier 1 security run, and stop for human merge approval.

## Verification performed
No test runner in F1 by design (F2 owns it). Evidence is the 16-probe D13 set, all passing: P-TOOLCHAIN, P-LOCK, P-DIVERGE, P-BUILD, P-LOAD, P-VERIFY (corrected), P-MEMBERS, P-MANIFESTS, P-EDGES, P-UNDECLARED, P-ORDER (inspection), P-BASELINE, P-ZERO, P-TECHSTACK, P-WORKFLOW, P-CI.

## TDD evidence
- RED: Two RED observations. (1) FR-025/SC-005: pnpm run build with an undeclared import of @chatter/telegram in packages/slack/src/index.ts failed exit 1 with TS2882. (2) P-VERIFY defect, independently reproduced by Codex and again here: from a built workspace, removing node_modules and every dist while leaving member tsconfig.tsbuildinfo files made 'bash scripts/dev.sh verify' exit 0 while recreating 0 of 8 build outputs.
- GREEN: (1) After byte-identical restore, pnpm install --frozen-lockfile && pnpm run build passed exit 0. (2) The corrected P-VERIFY, run from an intentionally stale build-info state, cleared build info itself via the approved 'pnpm run clean', invoked canonical verification (exit 0) and recreated 8 of 8 outputs with the lock digest unchanged.

## Git status
```text
clean
```

### Staged diff stat
```text
none
```
### Unstaged diff stat
```text
none
```

## Recent commits
```text
aa1f3f6 fix(verify): make P-VERIFY establish a genuinely cold build state
1f95532 docs(handoff): archive the previous handoff record
b639805 docs(evidence): record F1 TDD evidence, handoff and task completion
264fdc5 chore(verify): wire the F1 verification surface and record the stack pins
f22fecd feat(workspace): materialize the frozen pnpm workspace and TypeScript build graph
2ae0ae5 feat(container): add pinned Node 24.20.0 and pnpm 11.24.0 to the dev image
75816c9 docs(spec): add F1 workspace foundation plan and tasks
```

## Blockers
- None recorded.

## Open questions
- None recorded.

## Gotchas
- TypeScript writes tsconfig.tsbuildinfo NEXT TO each member tsconfig.json, not inside dist/. A dist-only deletion therefore leaves stale build state and 'tsc -b' reports every project up to date, so verification can exit 0 having built nothing. P-VERIFY now runs the approved 'pnpm run clean' first and asserts no member *.tsbuildinfo survives. A real cold clone is unaffected because *.tsbuildinfo is git-ignored.
- Observed, not designed: pnpm placed its content-addressable store at .pnpm-store/ inside the workspace because the /workspace bind mount and the /sdd-home HOME volume are different filesystems, so hard links require the store on the same filesystem. The path is git-ignored per FR-018. No compose.yaml change, no storeDir override, and the store location is NOT a public contract - it is an environment-dependent pnpm behaviour that may differ on other hosts.
