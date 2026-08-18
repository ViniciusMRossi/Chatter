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
import { Api } from "grammy";
import type { TelegramAccountConfig } from "../config/telegram-account-config.js";
import { UpdateDedupWindow } from "../dedup/update-dedup-window.js";
import { mapTelegramError } from "../errors/map-telegram-error.js";

const CAPABILITIES: ReadonlySet<Capability> = new Set(["text", "reply"]);
/** Telegram's documented per-message text limit (characters). */
const TELEGRAM_TEXT_LIMIT = 4096;

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
    if (input.attachment !== undefined) {
      // Attachment mapping is out of scope this ticket (see specs/004-attachment-model) —
      // this adapter never declares the "attachments" capability, so honor that honestly
      // rather than silently dropping the attachment or misreporting the failure reason.
      throw new ChatterUnsupportedCapabilityError(
        "this Telegram adapter does not support attachments",
      );
    }
    if (input.text === undefined) {
      // @chatter/core's SendInput.text became optional to support attachment-only sends
      // (see specs/004-attachment-model) — this adapter doesn't implement attachments yet
      // (that's the next ticket), so text is still required here for now.
      throw new ChatterConfigurationError(
        "this Telegram adapter requires message text — attachment-only sends are not yet supported",
      );
    }
    if (input.text.length > TELEGRAM_TEXT_LIMIT) {
      throw new ChatterConfigurationError(
        `Telegram message text exceeds the ${String(TELEGRAM_TEXT_LIMIT)}-character limit (got ${String(input.text.length)} characters)`,
      );
    }

    try {
      const result = await this.#api.sendMessage(
        Number(input.conversation.providerConversationId),
        input.text,
        input.replyToMessageId !== undefined
          ? { reply_parameters: { message_id: Number(input.replyToMessageId) } }
          : undefined,
      );
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

  /** Used by createTelegramWebhookHandler() to forward a mapped inbound message. */
  dispatchInbound(message: InboundMessage): void {
    this.#dispatch?.(message);
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
