import type { Mention } from "@chatter/core";
import type { MessageEntity } from "@grammyjs/types";
import { mapParticipant } from "./participant.js";

/**
 * Maps Telegram message entities onto normalized `Mention`s.
 *
 * Only two of Telegram's entity types denote a person:
 *
 * - `text_mention` carries a full `User` object — this is how Telegram represents a mention
 *   of someone with no public username — and becomes a *resolved* mention.
 * - `mention` is the ordinary `@handle` form. Telegram attaches no user id to it, because a
 *   handle can be renamed or transferred; it becomes an *unresolved* mention, carrying text
 *   and position but deliberately no participant.
 *
 * `bot_command` (`/start@somebot`) is NOT a mention. Telegram marks it as a command, not as a
 * reference to a person, and inferring otherwise would mean parsing the text ourselves — which
 * is exactly what this library must not do. The visible consequence is that a bare
 * `/command@botname` does not tell an application it was addressed; see spec.md FR-017.
 *
 * @param entities The entity array matching `text` — `entities` for a message body,
 *   `caption_entities` for a caption. Passing the array that does not match `text` yields
 *   offsets into the wrong string, so callers must select both together.
 * @param text The exact text the normalized message exposes, which offsets index into.
 * @param providerAccountId The bot's own Telegram user id, used both as the participant's
 *   account scope and to recognize a `text_mention` of the bot itself.
 * @param botUsername The bot's own username, used to recognize an `@handle` mention of itself.
 *   `undefined` when Telegram reports a bot with no username, in which case the handle form
 *   simply never matches — not an error.
 * @param onMalformed Optional non-fatal reporting channel for entities that are skipped.
 * @returns The mentions in provider-supplied order, or `undefined` when there are none — never
 *   an empty array, so callers can spread it conditionally.
 */
export function mapMentions(
  entities: readonly MessageEntity[] | undefined,
  text: string | undefined,
  providerAccountId: string,
  botUsername: string | undefined,
  onMalformed?: (message: string) => void,
): readonly Mention[] | undefined {
  if (entities === undefined || text === undefined) {
    return undefined;
  }

  const mentions: Mention[] = [];
  for (const entity of entities) {
    if (entity.type !== "mention" && entity.type !== "text_mention") {
      continue;
    }
    // Offsets are UTF-16 code units — the same unit `String.prototype.slice` uses — so this
    // bounds check and the slice below are in matching units. A malformed entity is skipped
    // rather than clamped: a clamped mention looks legitimate while carrying the wrong text.
    if (
      entity.offset < 0 ||
      entity.length < 0 ||
      entity.offset + entity.length > text.length
    ) {
      onMalformed?.(
        `skipped a malformed Telegram mention entity (offset ${String(entity.offset)}, ` +
          `length ${String(entity.length)}, text length ${String(text.length)})`,
      );
      continue;
    }

    const mentionText = text.slice(entity.offset, entity.offset + entity.length);

    if (entity.type === "text_mention") {
      mentions.push({
        text: mentionText,
        offset: entity.offset,
        length: entity.length,
        participant: mapParticipant(entity.user, providerAccountId),
        isSelf: String(entity.user.id) === providerAccountId,
      });
      continue;
    }

    // A plain `@handle`. No participant — see the doc comment above. Telegram usernames are
    // case-insensitive, and the casing here is whatever the sender typed, so both sides are
    // lowercased before comparison.
    const handle = mentionText.startsWith("@") ? mentionText.slice(1) : mentionText;
    mentions.push({
      text: mentionText,
      offset: entity.offset,
      length: entity.length,
      // A bot with no username never matches: `undefined?.toLowerCase()` is undefined, which
      // no string equals.
      isSelf: handle.toLowerCase() === botUsername?.toLowerCase(),
    });
  }

  return mentions.length > 0 ? mentions : undefined;
}
