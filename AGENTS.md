# Agent Instructions

These apply to any coding agent working in this repo, regardless of CLI/harness.

## Identity

Before making commits, set the agent git identity for this session:

    source scripts/agent-git-env.sh "<your-harness-name>"

e.g. `source scripts/agent-git-env.sh "claude-code"`. This makes your commits show as
"<human-name> [Agent]" without touching the human's own git config. When committing, add a
trailer identifying the specific harness:

    git commit -m "feat: short description" --trailer "Generated-by: $SDD_AGENT_HARNESS"

## Handoff

Run `scripts/handoff.sh` at these points, even if not explicitly asked to:

- **End of session** — `scripts/handoff.sh --reason manual`
- **When a ticket/feature is completed** —
  `scripts/handoff.sh --reason ticket-complete --ticket <id> --summary "<short summary>" --feature-complete`
  (this also appends an entry to `Docs/Dev-log.md`)
- **When context usage is getting high** (roughly 80%+ of budget) —
  `scripts/handoff.sh --reason context-low --summary "<where things stand>"`

This works the same way regardless of which CLI/harness you are — the script has no
CLI-specific dependencies. If your harness supports native custom commands or lifecycle hooks
(e.g. Claude Code's `/handoff` or session-end hooks), prefer those as a shortcut, but this script
is the source of truth either way.

## Tech stack

Do not deviate from `Docs/Tech-Stack-Constitution.md` without asking permission first. If the
standard tool/approach documented there doesn't fit a situation, propose an alternative and
record it — with rationale — in that file's "Tool substitution log" section *before* using it,
not after.

## Privacy & compliance

Check `Docs/Privacy-Compliance.md` before implementing anything that touches personal data.

## API documentation

Any ticket that adds or changes an HTTP-facing endpoint — a provider adapter's outbound calls
to the provider's API, or an inbound webhook endpoint — MUST add or update the corresponding
Bruno collection under `bruno/<provider>-adapter/` in the *same PR*. This is not optional
cleanup or a follow-up; treat it the same as updating the package's own README when its API
surface changes. See `bruno/README.md` for the collection format and conventions, and
`bruno/telegram-adapter/` for a worked example. Never commit a real token, secret, or credential
into a collection file — declare it `secret: true` with a blank value in the environment file;
Bruno stores what a developer fills in locally outside the synced collection.

Every request MUST have a `tests` block — these collections are executable test suites, not
just docs. For any endpoint that doesn't require a real provider credential (e.g. a webhook
handler under your own control), wire the corresponding folder into CI via a `test:bruno`
script in the owning package and a job in `.github/workflows/ci.yml`, following the pattern in
`packages/telegram/tests/bruno/` — a throwaway stub-backed test server, zero real credentials,
same as every other automated test in this project. Endpoints that call a real provider API
still get `tests` blocks (useful as a local smoke test with real credentials), but are never
wired into CI.

## Security

- Tier 1 (automated, every PR): Semgrep + secrets scan run in CI. Fix flagged issues before
  requesting review.
- Tier 2 (manual, major releases only): full penetration-test-style scan. Agents must never
  trigger this themselves — at most, flag to the human operator that a release looks like it
  warrants one (e.g. it touches auth, payments, or data boundaries) and let them decide.
