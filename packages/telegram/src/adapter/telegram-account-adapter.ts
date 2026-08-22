import {
  ChatterAuthenticationError,
  ChatterConfigurationError,
  ChatterUnsupportedCapabilityError,
  type AccountAdapter,
  type AdapterDeliveryResult,
  type Capability,
  type InboundMessage,
  type SendInput,
} from "@chatter/core";
import { timingSafeEqual } from "node:crypto";
import type { Message as TelegramMessage } from "@grammyjs/types";
import { Api, InputFile } from "grammy";
import type { TelegramAccountConfig } from "../config/telegram-account-config.js";
import { UpdateDedupWindow } from "../dedup/update-dedup-window.js";
import { mapTelegramError } from "../errors/map-telegram-error.js";
import { mapMessage } from "../mapping/message.js";

const CAPABILITIES: ReadonlySet<Capability> = new Set([
  "text",
  "reply",
  "attachments",
  "mentions",
]);
/** Telegram's documented per-message text limit (characters). */
const TELEGRAM_TEXT_LIMIT = 4096;
/** Telegram's real send-side size limits per attachment kind (bytes). */
const TELEGRAM_ATTACHMENT_SIZE_LIMITS: Record<string, number> = {
  image: 10_000_000,
  video: 50_000_000,
  file: 50_000_000,
};

export interface TelegramAccountAdapterOptions {
  /** Injectable for testing — defaults to a real grammY `Api` client. */
  readonly api?: Api;
  /**
   * Called when a best-effort cleanup step fails without preventing `stop()` from resolving
   * (e.g. `deleteWebhook` failing). Receives only a pre-sanitized message string — never the
   * raw error, bot token, or webhook secret. Defaults to `console.error`.
   */
  readonly onNonFatalError?: (message: string) => void;
}

export class TelegramAccountAdapter implements AccountAdapter {
  readonly provider = "telegram";

  readonly #config: TelegramAccountConfig;
  readonly #api: Api;
  readonly #dedupWindow = new UpdateDedupWindow();
  readonly #onNonFatalError: (message: string) => void;
  #botUserId: string | undefined;
  /**
   * The bot's own username, needed to recognize an `@handle` mention of itself — that form
   * carries no user id, so id comparison alone would miss the most common way a bot is
   * addressed. Read from the same `getMe()` response that supplies `#botUserId`, so it costs
   * no extra call. Stays `undefined` only for a bot Telegram reports without a username, in
   * which case handle-form mentions simply never match self.
   */
  #botUsername: string | undefined;
  #dispatch: ((message: InboundMessage) => void) | undefined;

  constructor(config: TelegramAccountConfig, options?: TelegramAccountAdapterOptions) {
    this.#config = config;
    this.#api = options?.api ?? new Api(config.botToken);
    this.#onNonFatalError =
      options?.onNonFatalError ??
      ((message) => {
        console.error(message);
      });
  }

  getCapabilities(): ReadonlySet<Capability> {
    return CAPABILITIES;
  }

  /** The bot's own Telegram user ID, used as `providerAccountId`. Set after `start()`. */
  get botUserId(): string | undefined {
    return this.#botUserId;
  }

  async start(dispatch: (message: InboundMessage) => void): Promise<void> {
    let me;
    try {
      me = await this.#api.getMe();
    } catch (error) {
      throw new ChatterAuthenticationError("Failed to authenticate with Telegram", {
        cause: mapTelegramError(error),
      });
    }
    this.#botUserId = String(me.id);
    this.#botUsername = me.username;

    try {
      await this.#api.setWebhook(this.#config.webhookUrl, {
        secret_token: this.#config.webhookSecret,
      });
    } catch (error) {
      throw mapTelegramError(error);
    }

    this.#dispatch = dispatch;
  }

  async stop(): Promise<void> {
    if (this.#botUserId === undefined) {
      // start() never completed — nothing was registered, nothing to tear down.
      return;
    }
    try {
      await this.#api.deleteWebhook();
    } catch (error) {
      // Best-effort cleanup — stop() still resolves either way — but the failure must be
      // discoverable rather than silently discarded. Routed through mapTelegramError first
      // so the surfaced message is sanitized the same way every other error path is.
      this.#onNonFatalError(mapTelegramError(error).message);
    }
    this.#dispatch = undefined;
  }

  async send(input: SendInput): Promise<AdapterDeliveryResult> {
    if (input.conversation.providerThreadId !== undefined) {
      // Telegram "topics" (forum threads) are out of scope this ticket — this adapter never
      // declares the "thread" capability, so honor that honestly rather than silently
      // dropping the thread target and sending to the wrong place.
      throw new ChatterUnsupportedCapabilityError(
        "this Telegram adapter does not support thread-targeted sends",
      );
    }
    if (input.text === undefined && input.attachment === undefined) {
      throw new ChatterConfigurationError(
        "this Telegram adapter requires message text or an attachment — a send needs at least one",
      );
    }
    if (input.text !== undefined && input.text.length > TELEGRAM_TEXT_LIMIT) {
      throw new ChatterConfigurationError(
        `Telegram message text exceeds the ${String(TELEGRAM_TEXT_LIMIT)}-character limit (got ${String(input.text.length)} characters)`,
      );
    }
    if (input.attachment !== undefined && "data" in input.attachment.source) {
      const limit = TELEGRAM_ATTACHMENT_SIZE_LIMITS[input.attachment.kind];
      const size = input.attachment.source.data.byteLength;
      if (limit !== undefined && size > limit) {
        throw new ChatterConfigurationError(
          `attachment exceeds the ${String(limit)}-byte limit for kind "${input.attachment.kind}" (got ${String(size)} bytes)`,
        );
      }
    }

    const replyParameters =
      input.replyToMessageId !== undefined
        ? { reply_parameters: { message_id: Number(input.replyToMessageId) } }
        : undefined;

    try {
      let result: { message_id: number; date: number };
      if (input.attachment !== undefined) {
        result = await this.#sendAttachment(input, replyParameters);
      } else if (input.text !== undefined) {
        result = await this.#api.sendMessage(
          Number(input.conversation.providerConversationId),
          input.text,
          replyParameters,
        );
      } else {
        // Unreachable: the no-text-and-no-attachment case was already rejected above.
        throw new ChatterConfigurationError("this Telegram adapter requires message text or an attachment");
      }
      return {
        provider: "telegram",
        providerMessageId: String(result.message_id),
        conversation: input.conversation,
        timestamp: new Date(result.date * 1000),
      };
    } catch (error) {
      throw mapTelegramError(error);
    }
  }

  #sendAttachment(
    input: SendInput,
    other: { reply_parameters: { message_id: number } } | undefined,
  ): Promise<{ message_id: number; date: number }> {
    const attachment = input.attachment;
    if (attachment === undefined) {
      throw new ChatterConfigurationError("expected an attachment to send");
    }
    const chatId = Number(input.conversation.providerConversationId);
    const media =
      "url" in attachment.source
        ? attachment.source.url
        : new InputFile(attachment.source.data, attachment.fileName);
    const params = { ...other, ...(input.text !== undefined ? { caption: input.text } : {}) };

    switch (attachment.kind) {
      case "image":
        return this.#api.sendPhoto(chatId, media, params);
      case "video":
        return this.#api.sendVideo(chatId, media, params);
      case "file":
        return this.#api.sendDocument(chatId, media, params);
    }
  }

  /** Used by createTelegramWebhookHandler() to forward a mapped inbound message. */
  dispatchInbound(message: InboundMessage): void {
    this.#dispatch?.(message);
  }

  /** Used by createTelegramWebhookHandler() to surface a non-fatal inbound mapping failure. */
  reportNonFatalError(message: string): void {
    this.#onNonFatalError(message);
  }

  /**
   * Maps a raw Telegram message into the normalized `InboundMessage` shape, resolving any
   * attachment's download URL via `getFile` internally — keeps the bot token fully
   * encapsulated in the adapter rather than exposing it to `createTelegramWebhookHandler()`.
   */
  mapInboundMessage(message: TelegramMessage): Promise<InboundMessage> {
    if (this.#botUserId === undefined) {
      throw new ChatterConfigurationError("cannot map an inbound message before start() completes");
    }
    return mapMessage(
      message,
      this.#botUserId,
      this.#api,
      this.#config.botToken,
      this.#botUsername,
      this.#onNonFatalError,
    );
  }

  /** Used by createTelegramWebhookHandler() to skip redelivered updates. */
  hasProcessedUpdate(updateId: number): boolean {
    return this.#dedupWindow.has(updateId);
  }

  /** Used by createTelegramWebhookHandler() to mark an update as processed. */
  recordProcessedUpdate(updateId: number): void {
    this.#dedupWindow.record(updateId);
  }

  /**
   * Timing-safe comparison against the configured webhook secret. The secret never leaves
   * the adapter instance — callers only ever get a boolean back, never the raw value.
   */
  validateWebhookSecret(provided: string | null): boolean {
    if (provided === null) {
      return false;
    }
    const expected = Buffer.from(this.#config.webhookSecret);
    const actual = Buffer.from(provided);
    if (actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  }
}
