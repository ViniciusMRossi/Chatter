# Handoff

_Last updated: 2026-08-22 21:17 UTC by unspecified (ticket-complete)_

## Where we are
- Branch: 007-message-edits-deletions
- Ticket: 007-message-edits-deletions

## Recent commits
```
dfcd6a5 docs(007): capability docs and executable Bruno coverage for edits
c0cb6e9 feat(core,telegram): capability-gated editMessage and deleteMessage
30816c1 Merge pull request #157 from ViniciusMRossi/007-message-edits-deletions
ef59907 feat(telegram): dispatch inbound message edits
dfdd169 test(testing): generalize inbound emission and hold edits to the contract
```

## Uncommitted changes
```
none
```

## Next step
Message edits and deletions: inbound edits as a distinct message.edited event (editedAt, id correlation, edit-accurate mentions), capability-gated editMessage/deleteMessage with provider-determined text-vs-caption, generalized conformance inbound emission, FR-012 deletion non-capability documented

## Open questions / blockers
_(edit as needed)_

## Gotchas
_(edit as needed — things a fresh session would otherwise rediscover the hard way)_

**Edits/deletions (007), things that bite silently:**
- `pnpm run typecheck` NEVER sees test files — every package's tsconfig is `"include": ["src"]`.
  tsc reported clean while 16 tests were broken by the `start()` signature change. Do not treat
  a green typecheck as proof a contract change is safe; run the tests.
- `@chatter/telegram` resolves `@chatter/testing` and `@chatter/core` from their **`dist/`**,
  not source. A conformance test failed against a stale build with the OLD error message until
  rebuilt. `pnpm --filter @chatter/core --filter @chatter/testing --filter @chatter/telegram
  build` before chasing a phantom failure.
- Bruno request schema: headers and body nest **inside** `http:` (`http.headers`,
  `http.body.type`/`http.body.data`). A top-level `headers:` block is silently ignored — the
  request just goes out without them, and you get a 401 that looks like a secret problem.
- The Telegram stub transport returns blanket `{ok:true, result:true}` for any method it does
  not model. Adding an outbound operation without teaching the stub its failure modes means
  conformance checks pass against targets the provider would have refused — the exact silent
  success the contract forbids. `editMessageText`/`editMessageCaption`/`deleteMessage` are now
  modelled; the next operation will need the same.
- `editMessage` costs TWO round trips for a caption and one for text, by design. The fallback
  fires only on `there is no text in the message to edit`. Do not "optimize" it into one call
  or broaden the retry — the tests assert the call sequence for exactly this reason.
- `edited_channel_post` is deliberately unhandled because inbound `channel_post` is unhandled.
  If channel posts are ever added, that branch needs revisiting.

