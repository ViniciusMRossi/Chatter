# Repository Settings

These settings are human-owned and must be configured after project creation.

## Protected default branch

For `main` (or the project's default branch), enable:

- require a pull request before merging;
- require at least one human approval;
- require review from Code Owners after `.github/CODEOWNERS` has real entries;
- require status checks `verify`, `semgrep`, and `gitleaks`;
- block force pushes and branch deletion;
- do not grant the coding agent permission to bypass branch protection.

## CODEOWNERS

Replace the commented example in `.github/CODEOWNERS` with real GitHub users/teams before enabling the Code Owner requirement.

## Agent permissions

Agents may create commits and PRs according to project policy, but the final merge gate remains human-controlled.

## Persistent development HOME

`sdd-home` intentionally survives ordinary `scripts/dev.* down` so Git and GitHub CLI state persist.
If the host uid/gid changes, the volume becomes unwritable, or you intentionally want to clear container-local identity/auth state, use the destructive reset command:

```text
Linux/macOS: bash scripts/dev.sh reset-home
Windows:     ./scripts/dev.ps1 reset-home
```

This stops the Compose project, resolves the named volume mounted specifically at `/sdd-home`, and removes only that volume. Other project volumes, such as future database data volumes, are preserved.

## First-PR Semgrep acceptance

Before making `semgrep` a permanent required check, verify the first real PR is diff-aware: a finding that already exists on the base branch must not make the PR red unless the PR changes/intensifies that finding. Record the result in the workflow acceptance matrix.
