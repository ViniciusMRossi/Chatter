import {
  ChatterConfigurationError,
  ChatterInvalidTargetError,
  ChatterRateLimitError,
  ChatterUnsupportedCapabilityError,
  conversationKey,
  type AccountAdapter,
  type AdapterDeliveryResult,
  type Capability,
  type InboundMessage,
  type SendInput,
} from "@chatter/core";

const DEFAULT_CAPABILITIES: Capability[] = ["text", "reply", "thread"];

export interface FakeAccountAdapterConfig {
  readonly capabilities?: Capability[];
  /** Enforced only against `{ data: Buffer }`-sourced attachments; unset means no size check. */
  readonly maxAttachmentSizeBytes?: number;
}

interface PendingRateLimit {
  readonly retryAfterMs: number | undefined;
}

export class FakeAccountAdapter implements AccountAdapter {
  readonly provider = "fake";
  readonly sentMessages: AdapterDeliveryResult[] = [];

  #capabilities: ReadonlySet<Capability>;
  #dispatch: ((message: InboundMessage) => void) | undefined;
  #knownConversationIds = new Set<string>();
  #knownMessageIds = new Set<string>();
  #maxAttachmentSizeBytes: number | undefined;
  #pendingRateLimit: PendingRateLimit | undefined;
  #sentCounter = 0;

  constructor(config?: FakeAccountAdapterConfig) {
    this.#capabilities = new Set(config?.capabilities ?? DEFAULT_CAPABILITIES);
    this.#maxAttachmentSizeBytes = config?.maxAttachmentSizeBytes;
  }

  getCapabilities(): ReadonlySet<Capability> {
    return this.#capabilities;
  }

  start(dispatch: (message: InboundMessage) => void): Promise<void> {
    this.#dispatch = dispatch;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.#dispatch = undefined;
    return Promise.resolve();
  }

  /** Test helper: simulates an inbound message arriving on this account. */
  emitInbound(message: InboundMessage): void {
    this.#knownConversationIds.add(
      conversationKey(
        message.conversation.provider,
        message.conversation.providerAccountId,
        message.conversation.providerConversationId,
      ),
    );
    this.#knownMessageIds.add(message.id);
    this.#dispatch?.(message);
  }

  /** Test helper: makes the next send() reject with ChatterRateLimitError. */
  simulateRateLimit(retryAfterMs?: number): void {
    this.#pendingRateLimit = { retryAfterMs };
  }

  // `async` is deliberate here: it turns the synchronous throws below into promise
  // rejections, matching the AccountAdapter contract's Promise-returning signature.
  // eslint-disable-next-line @typescript-eslint/require-await
  async send(input: SendInput): Promise<AdapterDeliveryResult> {
    if (this.#pendingRateLimit) {
      const { retryAfterMs } = this.#pendingRateLimit;
      this.#pendingRateLimit = undefined;
      throw new ChatterRateLimitError("fake account is rate-limited", { retryAfterMs });
    }

    if (input.replyToMessageId && !this.#capabilities.has("reply")) {
      throw new ChatterUnsupportedCapabilityError("this fake account does not support replies");
    }
    if (input.conversation.providerThreadId && !this.#capabilities.has("thread")) {
      throw new ChatterUnsupportedCapabilityError("this fake account does not support threads");
    }
    if (input.attachment && !this.#capabilities.has("attachments")) {
      throw new ChatterUnsupportedCapabilityError("this fake account does not support attachments");
    }
    if (
      input.attachment &&
      "data" in input.attachment.source &&
      this.#maxAttachmentSizeBytes !== undefined &&
      input.attachment.source.data.byteLength > this.#maxAttachmentSizeBytes
    ) {
      throw new ChatterConfigurationError(
        `attachment exceeds the ${String(this.#maxAttachmentSizeBytes)}-byte limit (got ${String(input.attachment.source.data.byteLength)} bytes)`,
      );
    }

    const key = conversationKey(
      input.conversation.provider,
      input.conversation.providerAccountId,
      input.conversation.providerConversationId,
    );
    if (!this.#knownConversationIds.has(key)) {
      throw new ChatterInvalidTargetError(
        `unknown conversation: ${input.conversation.providerConversationId}`,
      );
    }
    if (input.replyToMessageId && !this.#knownMessageIds.has(input.replyToMessageId)) {
      throw new ChatterInvalidTargetError(`unknown message to reply to: ${input.replyToMessageId}`);
    }

    this.#sentCounter += 1;
    const result: AdapterDeliveryResult = {
      provider: this.provider,
      providerMessageId: `fake-sent-${String(this.#sentCounter)}`,
      conversation: input.conversation,
      timestamp: new Date(),
    };
    this.sentMessages.push(result);
    return result;
  }
}
