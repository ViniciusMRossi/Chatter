# Dev Log

One short entry per shipped feature, appended by `scripts/handoff.sh --feature-complete`.
Keep the "what" brief — focus on challenges and problems faced, in more detail than the happy
path.

## 2026-08-17 — 1 (unspecified)
Core package foundation: normalized types, adapter contract, Chatter orchestrator, typed errors, fake adapter, and adapter-agnostic conformance suite (issues #1-#34)

## 2026-08-18 — 36 (unspecified)
Telegram provider adapter: webhook-based inbound (direct+group chats), outbound send/reply via grammY, typed error mapping, capability enforcement, conformance-suite compliance, example app (issues #36-#72)

## 2026-08-18 — 74 (unspecified)
Telegram adapter hardening: update_id dedup, migrate_to_chat_id surfacing, message-length pre-validation, non-silent stop() cleanup, manual verification checklist (issues #74-#93)

## 2026-08-18 — chatter-desktop (unspecified)
Electron desktop test client (example-apps/chatter-desktop) merged: Slack-style sidebar with multi-conversation support and real group names, inline image/audio playback, file chips with OS-default-app handoff. Includes a @chatter/telegram library fix (voice/audio message dispatch, previously silently dropped). Next: continue depth-first Telegram feature completion (message edits/deletions, reactions, mentions, interactive components) before starting Slack, per standing roadmap directive — no specific ticket scoped yet.

## 2026-08-22 — 006-mentions (claude-code)
Mentions: normalized Mention type in @chatter/core (UTF-16 offsets, optional participant, required isSelf) exposed as Message.mentions, plus a 'mentions' Capability; Telegram maps mention/text_mention entities for both text and captions, recognizing @handle and text_mention references to the bot itself. /command@botname deliberately produces no mention (FR-017). Conformance suite extended with an inbound-emission hook that FAILS rather than skips when an adapter declares 'mentions' without supplying it.

Problems worth remembering. The conformance suite turned out to be entirely send()-oriented, with no way to observe a dispatched inbound message — so an inbound-only feature could not be contract-tested at all without extending it first; the alternative was a Telegram unit test wearing a conformance label. Telegram supplies a separate entity array per text field (`entities` for text, `caption_entities` for caption) while mapMessage collapses both into one normalized `text`, so the two must be chosen by the same branch — reading the wrong array throws nothing and passes any test where both strings resemble each other. Offsets are UTF-16 code units, matching JS indexing exactly, so the "handle Unicode properly" instinct (`[...text]`, which indexes by code point) actively breaks emoji cases while looking right in ASCII. Bruno needed a new /last-message endpoint on the stub server: a correctly and an incorrectly mapped mention both return 200, so the FR-017 request would otherwise have asserted nothing.

Shipped on branch 006-mentions, 6 commits, not yet merged.

## 2026-08-22 — 007-message-edits-deletions (unspecified)
Message edits and deletions: inbound edits as a distinct message.edited event (editedAt, id correlation, edit-accurate mentions), capability-gated editMessage/deleteMessage with provider-determined text-vs-caption, generalized conformance inbound emission, FR-012 deletion non-capability documented

Problems worth remembering. The adapter contract had to break: `start()`'s callback carried a bare message and could express exactly one thing happening, so a second inbound kind had nowhere to go. Two backward-compatible escapes existed and both were worse — a second optional callback is the shape that makes the problem permanent (reactions add a third parameter), and widening the parameter to a union typechecks under method bivariance but leaves two ways to say "message created" forever. Taking the break cost one commit; either alternative would have cost every future inbound feature.

`pnpm run typecheck` never sees test files — every tsconfig is `include: ["src"]` — so tsc reported clean while 16 tests were broken by that signature change. A green typecheck is not evidence a contract change is safe. Relatedly, telegram resolves the sibling packages from `dist/`, so a stale build produced a conformance failure quoting an error message that no longer existed in source.

The stub transport returned blanket success for any method it did not model, which meant the new outbound conformance checks passed against a target the provider would have refused — precisely the silent success the contract forbids. The checks failing was the suite working; the fix was teaching the stub Telegram's real answers, including that an unchanged edit is an error rather than a no-op.

Deciding whether an edit targets text or a caption cannot be done locally: Chatter keeps no record of what it sent (constitutionally) and Telegram gives bots no way to fetch a message by id, so the only honest answer is to attempt the text edit and react to one specific rejection. Captions therefore cost two round trips, permanently. FR-020 (an unchanged edit is a failure, not a success) was the one fork with no defensible default and went to the user.

Bruno needed a second introspection endpoint, `/last-event`: a correctly dispatched edit and one wrongly routed through the created-message path leave the same message behind and both answer 200, so `/last-message` could not tell them apart — and that distinction is the entire point of FR-002.
