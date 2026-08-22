import {
  ChatterConfigurationError,
  ChatterInvalidTargetError,
  ChatterRateLimitError,
  ChatterUnsupportedCapabilityError,
  conversationKey,
  type AccountAdapter,
  type AdapterDeliveryResult,
  type Capability,
  type InboundEvent,
  type InboundMessage,
  type SendInput,
} from "@chatter/core";

const DEFAULT_CAPABILITIES: Capability[] = ["text", "reply", "thread"];
/** Account scope for participants this fake synthesizes. */
const FAKE_ACCOUNT_ID = "fake-account";

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
  #dispatch: ((event: InboundEvent) => void) | undefined;
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

  start(dispatch: (event: InboundEvent) => void): Promise<void> {
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
    this.#dispatch?.({ kind: "message.created", message });
  }

  /**
   * Test helper: simulates an inbound message carrying mentions, covering every branch the
   * conformance suite requires — a resolved mention, an unresolved one, a mention of this
   * account itself, and one that is not.
   *
   * The text and offsets are real: each mention's offset/length genuinely slices its own text
   * out of `text`, including across the emoji, so this helper exercises the same UTF-16
   * code-unit invariant a real adapter must satisfy rather than a simplified stand-in.
   */
  emitInboundWithMentions(conversationId = "mentions-conversation"): void {
    const text = "👋 @self hello @alice and Bob Smith";
    const conversation = {
      provider: this.provider,
      providerAccountId: FAKE_ACCOUNT_ID,
      providerConversationId: conversationId,
      type: "group" as const,
    };

    this.emitInbound({
      id: "mentions-message-1",
      provider: this.provider,
      sender: {
        provider: this.provider,
        providerAccountId: FAKE_ACCOUNT_ID,
        providerParticipantId: "fake-sender",
      },
      conversation,
      text,
      createdAt: new Date(),
      mentions: [
        // Unresolved and self: the handle form carries no id, exactly as a real provider
        // delivers it — recognizing ourselves does not license inventing a participant.
        { text: "@self", offset: 3, length: 5, isSelf: true },
        // Unresolved, not self.
        { text: "@alice", offset: 15, length: 6, isSelf: false },
        // Resolved, not self.
        {
          text: "Bob Smith",
          offset: 26,
          length: 9,
          participant: {
            provider: this.provider,
            providerAccountId: FAKE_ACCOUNT_ID,
            providerParticipantId: "fake-bob",
            displayName: "Bob Smith",
          },
          isSelf: false,
        },
      ],
    });
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
