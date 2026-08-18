import {
  ChatterAuthenticationError,
  ChatterInvalidTargetError,
  ChatterProviderUnavailableError,
  ChatterRateLimitError,
  ChatterUnknownError,
  type ChatterError,
} from "@chatter/core";
import { GrammyError, HttpError } from "grammy";

const BLOCKED_OR_KICKED_PATTERN = /blocked|kicked/i;
const CHAT_NOT_FOUND_PATTERN = /chat not found/i;

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

    if (errorCode === 401) {
      return new ChatterAuthenticationError(`Telegram authentication failed: ${description}`, {
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
