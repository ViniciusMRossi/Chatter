# Handoff

_Updated: 2026-08-31 22:26 UTC | harness: claude-code | reason: feature-progress_

## Current work
- Feature/spec: 001-repository-workspace-foundation
- Tracking issue: unspecified
- Branch: 001-repository-workspace-foundation
- PR: https://github.com/ViniciusMRossi/chatter/pull/1

## Summary
F1 Repository / Workspace Foundation complete: T001-T041. PR #1 is open against main at HEAD 8d51eac with all three required checks green (verify pass, gitleaks pass, semgrep pass). The dev image pins Node 24.20.0 (checksum-verified) and pnpm 11.24.0; the frozen eight-member workspace builds with a single tsc -b; six libraries emit .js/.js.map/.d.ts/.d.ts.map; dev.sh verify exits 0 from a genuinely cold checkout. Zero Chatter behaviour, zero provider SDKs, zero F2/F3 scope. Not merged.

## Next step
Human review and merge approval on PR #1. Do not auto-merge; the agent must not merge or bypass protection.

## Verification performed
No test runner in F1 by design (F2 owns it). Evidence: the 16-probe D13 set, all passing, including the extended P-MANIFESTS which now asserts all six pnpm-workspace.yaml settings by exact value and rejects any policy-exception key. CI on HEAD 8d51eac: verify pass, gitleaks pass, semgrep pass.

## TDD evidence
- RED: Semgrep on PR #1 HEAD 5648627 reported 3 blocking supply-chain findings on the newly introduced pnpm-workspace.yaml: pnpm-block-exotic-sub-dependencies, pnpm-missing-minimum-release-age, pnpm-trust-policy. The scan was correctly diff-aware (baseline-limited, 47 targets, file absent from main), so these were true positives, not legacy-baseline noise.
- GREEN: After the human-authorized adoption of blockExoticSubdeps: true, minimumReleaseAge: 10080 and trustPolicy: no-downgrade, the frozen install passed with exit 0 and pnpm reported 'Lockfile passes supply-chain policies'; pnpm-lock.yaml was unchanged. Semgrep now passes on HEAD 8d51eac alongside verify and gitleaks.

## Git status
```text
 M specs/001-repository-workspace-foundation/tasks.md
```

### Staged diff stat
```text
none
```
### Unstaged diff stat
```text
 specs/001-repository-workspace-foundation/tasks.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

## Recent commits
```text
8d51eac fix(supply-chain): adopt pnpm blockExoticSubdeps, minimumReleaseAge and trustPolicy
5648627 docs(handoff): refresh handoff after the P-VERIFY correction
aa1f3f6 fix(verify): make P-VERIFY establish a genuinely cold build state
1f95532 docs(handoff): archive the previous handoff record
b639805 docs(evidence): record F1 TDD evidence, handoff and task completion
264fdc5 chore(verify): wire the F1 verification surface and record the stack pins
f22fecd feat(workspace): materialize the frozen pnpm workspace and TypeScript build graph
```

## Blockers
- None recorded.

## Open questions
- None recorded.

## Gotchas
- The three pnpm supply-chain settings were adopted AFTER PR #1 as a Tier 1 Semgrep correction, not during initial planning. minimumReleaseAge: 10080 replaces pnpm 11's built-in one-day default with an explicit seven-day delay, and because it is set explicitly pnpm's strict minimum-release-age behaviour applies by default. trustPolicy: no-downgrade fails installation when a version's trust evidence is weaker than an earlier-published version. blockExoticSubdeps: true makes pnpm's current secure default explicit. No exception key is configured.
- TypeScript writes tsconfig.tsbuildinfo NEXT TO each member tsconfig.json, not inside dist/, so a dist-only deletion leaves stale build state and verification can exit 0 having built nothing. P-VERIFY runs the approved pnpm run clean first and asserts no member tsbuildinfo survives.
