# Handoff

_Last updated: 2026-08-22 18:07 UTC by claude-code (ticket-complete)_

## Where we are
- Branch: 006-mentions
- Ticket: 006-mentions

## Recent commits
```
9db8489 docs(bruno): executable mention coverage for the webhook collection
146ab86 feat(telegram): map Telegram mention entities onto the normalized model
78d1504 test(testing): hold mention-declaring adapters to the shared contract
c7d49a8 feat(core): normalized Mention model and mentions capability
d178380 docs(006-mentions): spec, plan, research, and task breakdown
```

## Uncommitted changes
```
 Docs/Dev-log.md |  7 +++++++
 Docs/handoff.md | 28 +++++++++++++++++++++++-----
 2 files changed, 30 insertions(+), 5 deletions(-)
```

## Next step
006-mentions complete on branch 006-mentions (6 commits, not merged). Inbound mention support: Mention type in @chatter/core, Telegram entity mapping for text and captions, isSelf detection, conformance-suite enforcement, Bruno coverage. Full gate green: lint, typecheck, core 20 / testing 35 / telegram 103 tests, Bruno 18 requests / 22 tests. Next: open a PR for review, then continue depth-first Telegram completion (edits/deletions, reactions, interactive components) before Slack. Note: example-apps/chatter-desktop build is broken on Windows (mkdir -p / cp in its build script) - pre-existing, untouched by this ticket.

## Open questions / blockers
_(edit as needed)_

## Gotchas
_(edit as needed — things a fresh session would otherwise rediscover the hard way)_

**Environment (Windows):**
- `node_modules` is not checked in and was absent — `pnpm install` before anything.
- `.specify/scripts/python/setup_tasks.py --json` crashes with a cp1252 `UnicodeEncodeError`
  (the templates contain emoji). Run it as `PYTHONIOENCODING=utf-8 python3 ...`.
- `example-apps/chatter-desktop`'s build script uses `mkdir -p` and `cp`, which fail under
  Windows cmd, so `pnpm -r build` fails there. Pre-existing; the three library packages build
  fine. Don't mistake it for something you broke.
- The Bash tool's working directory persists between calls — a `cd` into a subfolder silently
  changes where later `find`/`git ls-files` calls look.

**Mentions (006), things that bite silently:**
- Telegram entity offsets are UTF-16 code units, which matches JS string indexing exactly. Do
  not "fix" them with `[...text]`/`Array.from` — that indexes by code point and shifts every
  mention after an emoji. Passes ASCII tests, wrong in real chats.
- `entities` indexes into `message.text`; `caption_entities` indexes into `message.caption`.
  `mapMessage` collapses both into one normalized `text`, so the entity array MUST be chosen by
  the same branch that chooses the text. Getting this wrong throws nothing and looks fine in any
  test where the two strings resemble each other.
- The `@handle` form carries no user id, on purpose — do not synthesize a participant from it.
- `/command@botname` produces no mention by design (FR-017), so a bot is NOT told it was
  addressed by a bare group command. If that needs to change, it's a spec change with its own
  ticket, not a mapper fix — the tests and Bruno requests say so explicitly.

**Conformance suite:**
- It is otherwise entirely `send()`-oriented. Any future inbound-only feature (edits, deletions,
  reactions) will hit the same wall mentions did and needs its own emission hook.
- An adapter declaring `"mentions"` without supplying `emitInboundWithMentions` fails loudly
  rather than skipping. That is deliberate — don't "fix" it into a skip.
