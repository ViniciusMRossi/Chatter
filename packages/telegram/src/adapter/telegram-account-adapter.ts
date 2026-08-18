import {
  ChatterAuthenticationError,
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
import { mapTelegramError } from "../errors/map-telegram-error.js";

const CAPABILITIES: ReadonlySet<Capability> = new Set(["text", "reply"]);

export interface TelegramAccountAdapterOptions {
  /** Injectable for testing — defaults to a real grammY `Api` client. */
  readonly api?: Api;
}

export class TelegramAccountAdapter implements AccountAdapter {
  readonly provider = "telegram";

  readonly #config: TelegramAccountConfig;
  readonly #api: Api;
  #botUserId: string | undefined;
  #dispatch: ((message: InboundMessage) => void) | undefined;

  constructor(config: TelegramAccountConfig, options?: TelegramAccountAdapterOptions) {
    this.#config = config;
    this.#api = options?.api ?? new Api(config.botToken);
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
    } catch {
      // Best-effort cleanup on stop(); nothing more useful to do if this fails.
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
