import { Api, type Transformer } from "grammy";
import type { ApiError, ApiResponse } from "@grammyjs/types";

export interface RecordedCall {
  readonly method: string;
  readonly payload: Record<string, unknown>;
}

const DEFAULT_BOT_ID = 987_654_321;

/**
 * A chat ID the stub always rejects as unknown to Telegram — a stand-in for a chat the bot
 * has never interacted with, used by the conformance suite's `getUnknownConversation()`.
 */
export const UNKNOWN_CHAT_ID = -999_999_999;

/**
 * Wraps a grammY `Api` instance with a transformer that intercepts every outbound call
 * before any real HTTP request is made — no real network access anywhere in this harness.
 * Sensible defaults are returned for getMe/sendMessage/setWebhook/deleteWebhook; queue a
 * canned response (success or a synthetic Telegram error) for a specific method to override
 * that default for the next call to it.
 */
export class StubTelegramTransport {
  readonly api: Api;
  readonly calls: RecordedCall[] = [];

  #queues = new Map<string, ApiResponse<unknown>[]>();
  #sentMessageCounter = 0;

  constructor(botToken = "test-token:stub") {
    this.api = new Api(botToken);
    // A stub transformer necessarily loses grammY's per-method generic specificity — it
    // handles every method the same way. This is test-only infrastructure, not shipped code.
    const stubTransformer = ((_prev: unknown, method: string, payload: unknown) => {
      const recordedPayload = (payload ?? {}) as Record<string, unknown>;
      this.calls.push({ method, payload: recordedPayload });
      return Promise.resolve(this.#respond(method, recordedPayload));
    }) as unknown as Transformer;
    this.api.config.use(stubTransformer);
  }

  /** Queues a response for the next call to `method`, overriding the default. */
  queue(method: string, response: ApiResponse<unknown>): void {
    const queue = this.#queues.get(method) ?? [];
    queue.push(response);
    this.#queues.set(method, queue);
  }

  /** Convenience: queues a synthetic Telegram API error for the next call to `method`. */
  queueError(method: string, error: ApiError): void {
    this.queue(method, error);
  }

  #respond(method: string, payload: Record<string, unknown>): ApiResponse<unknown> {
    return this.#queues.get(method)?.shift() ?? this.#defaultResponse(method, payload);
  }

  #defaultResponse(method: string, payload: Record<string, unknown>): ApiResponse<unknown> {
    switch (method) {
      case "getMe":
        return {
          ok: true,
          result: {
            id: DEFAULT_BOT_ID,
            is_bot: true,
            first_name: "Test Bot",
            username: "chatter_test_bot",
            can_join_groups: true,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
          },
        };
      case "sendMessage": {
        if (payload.chat_id === UNKNOWN_CHAT_ID) {
          return { ok: false, error_code: 400, description: "Bad Request: chat not found" };
        }
        this.#sentMessageCounter += 1;
        return {
          ok: true,
          result: {
            message_id: this.#sentMessageCounter,
            date: Math.floor(Date.now() / 1000),
            chat: { id: payload.chat_id, type: "private" },
            text: payload.text,
          },
        };
      }
      case "setWebhook":
      case "deleteWebhook":
        return { ok: true, result: true };
      default:
        return { ok: true, result: true };
    }
  }
}
