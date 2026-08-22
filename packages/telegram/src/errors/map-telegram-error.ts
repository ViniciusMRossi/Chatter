import {
  ChatterAuthenticationError,
  ChatterAuthorizationError,
  ChatterConfigurationError,
  ChatterInvalidTargetError,
  ChatterProviderUnavailableError,
  ChatterRateLimitError,
  ChatterUnknownError,
  type ChatterError,
} from "@chatter/core";
import { GrammyError, HttpError } from "grammy";

const BLOCKED_OR_KICKED_PATTERN = /blocked|kicked/i;
const CHAT_NOT_FOUND_PATTERN = /chat not found/i;
/** The target message is gone or was never reachable — distinct from being refused. */
const MESSAGE_NOT_FOUND_PATTERN = /message to (edit|delete) not found|message identifier is not specified/i;
/**
 * A refusal on permission grounds. Telegram folds the elapsed-time refusal
 * ("can't be deleted for everyone") in here rather than giving it a distinct code, so it
 * shares this category — see the note in `mapTelegramError`.
 */
const NOT_PERMITTED_PATTERN = /message can't be (edited|deleted)/i;
/** Only meaningful for an edit; see `mapTelegramEditError`. */
const NOT_MODIFIED_PATTERN = /message is not modified/i;
/** The message has a caption rather than text — an instruction to retry, not a failure. */
const NO_TEXT_TO_EDIT_PATTERN = /there is no text in the message to edit/i;

/**
 * Maps a failure from a Telegram Bot API call onto the shared ChatterError hierarchy.
 * Never interpolates a GrammyError's raw fields (which are safe — see below) blindly into
 * a new message without going through this table, and never surfaces an HttpError's
 * underlying cause, since that can include the request URL, which for Telegram's Bot API
 * embeds the bot token directly (`https://api.telegram.org/bot<TOKEN>/...`).
 */
export function mapTelegramError(error: unknown): ChatterError {
  if (error instanceof GrammyError) {
    // GrammyError's own fields (method, payload, error_code, description) are Telegram
    // Bot-API-language text and structured data — never the request URL or token — so it's
    // safe to attach as `cause`.
    const { error_code: errorCode, description } = error;
    const migrateToChatId = error.parameters.migrate_to_chat_id;

    if (migrateToChatId !== undefined) {
      return new ChatterInvalidTargetError(
        `Telegram target invalid: chat migrated to supergroup, new chat ID: ${String(migrateToChatId)}`,
        { cause: error },
      );
    }
    if (errorCode === 401) {
      return new ChatterAuthenticationError(`Telegram authentication failed: ${description}`, {
        cause: error,
      });
    }
    if (errorCode === 400 && MESSAGE_NOT_FOUND_PATTERN.test(description)) {
      return new ChatterInvalidTargetError(`Telegram target invalid: ${description}`, {
        cause: error,
      });
    }
    if (errorCode === 400 && NOT_PERMITTED_PATTERN.test(description)) {
      // Covers both "you may not touch this message" and Telegram's elapsed-time refusal
      // ("can't be deleted for everyone"), which it reports as a permission failure rather
      // than a distinct code. Sharing the category is a known coarseness, kept deliberately:
      // the category is truthful, and manufacturing a finer distinction from description
      // text alone would assert something the provider is not saying. The provider's own
      // words are preserved in the message and the raw error is attached as `cause`.
      return new ChatterAuthorizationError(`Telegram refused the operation: ${description}`, {
        cause: error,
      });
    }
    if (errorCode === 400 && CHAT_NOT_FOUND_PATTERN.test(description)) {
      return new ChatterInvalidTargetError(`Telegram target invalid: ${description}`, {
        cause: error,
      });
    }
    if (errorCode === 403 && BLOCKED_OR_KICKED_PATTERN.test(description)) {
      return new ChatterInvalidTargetError(`Telegram target invalid: ${description}`, {
        cause: error,
      });
    }
    if (errorCode === 429) {
      const retryAfterSeconds = error.parameters.retry_after;
      return new ChatterRateLimitError(`Telegram rate limit exceeded: ${description}`, {
        cause: error,
        retryAfterMs: retryAfterSeconds !== undefined ? retryAfterSeconds * 1000 : undefined,
      });
    }
    return new ChatterUnknownError(`Telegram API error: ${description}`, { cause: error });
  }

  if (error instanceof HttpError) {
    // Deliberately no `cause` here and a fixed, generic message — HttpError wraps a raw
    // fetch failure whose own message/cause can include the request URL (and therefore the
    // bot token). See FR-001 / NFR-004.
    return new ChatterProviderUnavailableError("Telegram API request failed", {
      retryable: true,
    });
  }

  return new ChatterUnknownError("Unexpected error calling the Telegram API", { cause: error });
}

/**
 * True when Telegram is saying "this message has a caption, not text" — which is an
 * instruction to retry against the caption endpoint, not a failure to report.
 */
export function isNoTextToEdit(error: unknown): boolean {
  return error instanceof GrammyError && NO_TEXT_TO_EDIT_PATTERN.test(error.description);
}

/**
 * Error mapping for the edit path specifically.
 *
 * "message is not modified" is scoped HERE rather than added to the global table on purpose:
 * it is only meaningful for an edit, and reinterpreting that description wherever else it
 * might arise would assert a meaning the call site does not have.
 *
 * It maps to ChatterConfigurationError because that is already this codebase's category for
 * caller-supplied input the provider will reject — the same category `send()` raises for
 * over-length text and oversized attachments. It deliberately does NOT map to
 * ChatterInvalidTargetError (the target is valid and reachable) or ChatterAuthorizationError
 * (nothing was refused on permission grounds); either would send a developer hunting a defect
 * that is not there.
 */
export function mapTelegramEditError(error: unknown): ChatterError {
  if (error instanceof GrammyError && NOT_MODIFIED_PATTERN.test(error.description)) {
    return new ChatterConfigurationError(
      `Telegram rejected the edit: ${error.description} — the message already has that content`,
      { cause: error },
    );
  }
  return mapTelegramError(error);
}
