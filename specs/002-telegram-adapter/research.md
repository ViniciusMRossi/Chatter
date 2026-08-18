# Phase 0 Research: Telegram Provider Adapter

All Technical Context items were resolvable from the ratified stack decisions
(`Docs/Tech-Stack-Constitution.md`), the ticket #1 contract, and the human's Phase 2 answers
(webhook transport, grammY) — no open unknowns remain.

## Decision: Wrap grammY's `webhookCallback()`, validate the secret ourselves, first

**Decision**: The exposed webhook handler is our own function with signature
`(request: Request) => Promise<Response>`. Internally it: (1) reads the
`X-Telegram-Bot-Api-Secret-Token` header directly from the raw request, (2) compares it against
the configured secret using `node:crypto`'s `timingSafeEqual`, (3) only if that passes, hands the
request off to grammY's own `webhookCallback(bot, "std/http")` (or equivalent generic adapter) to
parse the Telegram `Update` body and drive the bot instance.

**Rationale**: FR-003 requires rejecting unauthenticated requests *before* normalizing or
dispatching anything — if secret validation happened inside or after grammY's own request
handling, a malformed-but-unauthenticated request could still cause parsing work or, worse, a
future grammY version could dispatch before our check runs. Validating the header ourselves,
first, against the raw request, removes that ordering dependency entirely. `timingSafeEqual`
requires equal-length buffers; a length mismatch (e.g. no header at all) is treated as "not
equal" without ever calling it, so a missing header can't throw past the check.

**Alternatives considered**: Relying on a grammY plugin/middleware for secret validation
(rejected — inspected grammY's own webhook helpers; they do support secret-token checking, but
mixing our validation timing with an SDK's own internal request lifecycle for a security-critical
gate is exactly the coupling the constitution's Principle VI is trying to avoid — doing it
ourselves is more auditable and doesn't depend on tracking a dependency's internal behavior
across upgrades).

## Decision: Telegram `chat.type` → Chatter `ConversationType` mapping

**Decision**: `"private"` → `"direct"`; `"group"` and `"supergroup"` → `"group"`; anything else
(`"channel"`, or any future Telegram chat type) → `"unknown"`, never a crash.

**Rationale**: Matches the shared `ConversationType` union from ticket #1 exactly (`"direct" |
"group" | "channel" | "unknown"`). Telegram channels are explicitly out of scope for this ticket
(spec Assumptions) — rather than silently mis-mapping a channel post to "group" (which would be
wrong) or throwing (which would violate NFR-005's "must not silently lose state" by crashing on
an unexpected-but-valid provider payload), unrecognized types map to the model's own escape
hatch, `"unknown"`, exactly as the normalized model was designed to allow (requirements doc
FR-007).

**Alternatives considered**: Throwing on an unrecognized chat type (rejected — a documented
non-goal chat type reaching the webhook isn't a bug the host application needs an exception for;
`"unknown"` already exists in the model precisely for this).

## Decision: Error mapping table (Telegram Bot API → `ChatterError`)

**Decision**:

| Telegram condition | Chatter error |
|---|---|
| HTTP 401 / "Unauthorized" (bad token) | `ChatterAuthenticationError` |
| HTTP 400 "chat not found" | `ChatterInvalidTargetError` |
| HTTP 403 "bot was blocked by the user" / "bot was kicked" | `ChatterInvalidTargetError` |
| HTTP 429 "Too Many Requests" (flood control) | `ChatterRateLimitError`, `retryAfterMs = retry_after * 1000` from Telegram's payload |
| Network failure (no response) or HTTP 5xx | `ChatterProviderUnavailableError`, `retryable: true` |
| Anything else grammY surfaces | `ChatterUnknownError`, original error attached via `cause` |

**Rationale**: Directly satisfies FR-008 and Story 4. Telegram's `GrammyError` (thrown by grammY
for Bot API error responses) carries `error_code` and `description`, and its `HttpError`
(network-level failures) is distinguishable by type — both are mapped at one boundary (the
adapter's outbound-call wrapper) so every `send()` failure path goes through the same
translation logic rather than being handled ad hoc per call site.

**Alternatives considered**: Passing grammY's own error types through directly (rejected —
violates constitution Principle V; also risks leaking the bot token, since `GrammyError`/
`HttpError` messages can include the request URL, which for Telegram's Bot API embeds the token
directly — this is exactly why FR-001's "never log the token" requirement extends to error
messages, not just deliberate log lines).

## Decision: Non-live test strategy — stub the transport, not the network

**Decision**: Tests construct a grammY `Bot` (or an equivalent minimal client) with its outbound
HTTP transport replaced by an in-memory stub that records calls and returns canned responses
(success payloads, or synthetic Telegram error payloads per the mapping table above). Inbound
tests POST synthetic `Update` JSON bodies (with the correct secret header) directly at the
webhook handler function, in-process — no real HTTP server, no real network socket.

**Rationale**: Satisfies FR-010/NFR-009 (zero real credentials, CI-safe) while still exercising
the adapter's actual mapping and error-handling code paths, not a hand-rolled reimplementation of
them. This is the same "fake the boundary, exercise the real logic" principle ticket #1's
`FakeAccountAdapter` already established, applied here to Telegram's specific I/O boundary
(HTTP) instead of the whole adapter.

**Alternatives considered**: Recording real HTTP fixtures against a live test bot and replaying
them (rejected as unnecessary ceremony for this ticket's scope — synthetic payloads built from
Telegram's publicly documented `Update`/`Message` schema are sufficient and don't require
maintaining a live credential anywhere, even in a fixture-recording step).

## Decision: `getKnownConversation`/`getUnknownConversation` for the conformance suite

**Decision**: The Telegram adapter's `conformance.spec.ts` constructs the adapter with the same
stubbed transport from the non-live strategy above. `getKnownConversation` feeds a synthetic
inbound `Update` through the webhook handler (with a valid secret) to make a chat "known" the
same way a real webhook delivery would, then returns that chat's conversation reference.
`getUnknownConversation` returns a conversation reference for a chat ID never delivered.

**Rationale**: Directly fulfills ticket #1 Story 4's promise — "a future real adapter can be
pointed at [the conformance suite] with no core changes" — by using the adapter's real inbound
path (webhook handler + secret validation + mapping) rather than a shortcut, so the conformance
run is actually exercising production code, not a test-only bypass.
