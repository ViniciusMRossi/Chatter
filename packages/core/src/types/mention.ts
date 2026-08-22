import type { Participant } from "./participant.js";

/**
 * A single reference to a person within a message's text.
 *
 * Mentions are reported from structured metadata the provider supplies alongside the
 * message — Chatter never scans message text looking for `@`-shaped things. A provider
 * that reports no mentions produces no mentions here, even if its text visibly contains
 * something that looks like one.
 */
export interface Mention {
  /**
   * The mention exactly as it appears in the message text — e.g. `"@alice"` for a handle
   * mention, or the person's display name where the provider links a name directly.
   *
   * Always equals `message.text.slice(offset, offset + length)`.
   */
  readonly text: string;
  /**
   * Start of the mention within the message's `text`, in UTF-16 code units.
   *
   * UTF-16 code units are what JavaScript string indexing already uses, so
   * `text.slice(offset, offset + length)` is correct as written and needs no conversion.
   * These are NOT code-point offsets: in `"👋 @alice"` the mention starts at offset 3,
   * because the emoji occupies two code units. Iterating with `[...text]` or
   * `Array.from(text)` indexes by code point instead and will shift every mention after
   * an emoji — correct-looking in ASCII tests, wrong in real conversations.
   */
  readonly offset: number;
  /** Length of the mention in UTF-16 code units. See {@link Mention.offset}. */
  readonly length: number;
  /**
   * The referenced person, when the provider identifies them.
   *
   * Absent when the provider reports a mention it cannot resolve to a specific account —
   * notably a plain `@handle`, which many providers deliver with no underlying user id
   * because a handle is not a stable identifier: it can be renamed or transferred to a
   * different person. Deriving an id from the handle would mint an identifier that
   * silently reassigns itself to someone else when that happens, so this field is left
   * absent rather than filled with a synthesized value.
   */
  readonly participant?: Participant;
  /**
   * Whether this mention refers to the connected account itself.
   *
   * Required rather than optional: an optional boolean would have three states for a
   * two-state question, and `if (mention.isSelf)` would silently read "undetermined" as
   * "not me". Adapters establish the connected account's own identity before mapping any
   * message, so there is no third state to represent.
   */
  readonly isSelf: boolean;
}
