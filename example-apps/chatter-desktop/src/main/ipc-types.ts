/**
 * Opaque handle for a conversation — the same string @chatter/core's own conversationKey()
 * produces. The renderer only ever holds this string, never a real Conversation object; the
 * main process resolves it back to the authoritative one when sending, so a compromised or
 * buggy renderer can never spoof a send target it wasn't handed.
 */
export type ConversationKeyString = string;

export interface ConversationSummary {
  readonly key: ConversationKeyString;
  readonly label: string;
}

/** The renderer-safe view of a message — never includes a raw attachment download URL. */
export interface MessageView {
  readonly id: string;
  readonly conversationKey: ConversationKeyString;
  readonly direction: "inbound" | "outbound";
  readonly sender: string;
  readonly timestamp: number;
  readonly text?: string;
  readonly attachment?: {
    readonly kind: "image" | "video" | "file";
    readonly fileName?: string;
    readonly mimeType?: string;
    readonly sizeBytes?: number;
    /**
     * Set for images and playable audio (kind "file" with an "audio/…" mimeType — Telegram
     * voice messages and audio files both map to "file", see @chatter/telegram's README) — a
     * data: URL, never the original (token-bearing) download URL.
     */
    readonly previewDataUrl?: string;
  };
}

export interface StatusView {
  readonly text: string;
  readonly level: "info" | "error";
}

export const IPC_CHANNELS = {
  message: "chatter:message",
  status: "chatter:status",
  conversations: "chatter:conversations",
  sendText: "chatter:send-text",
  pickAttachment: "chatter:pick-attachment",
  openAttachment: "chatter:open-attachment",
} as const;
