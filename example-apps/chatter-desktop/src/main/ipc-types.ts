/** The renderer-safe view of a message — never includes a raw attachment download URL. */
export interface MessageView {
  readonly id: string;
  readonly direction: "inbound" | "outbound";
  readonly sender: string;
  readonly timestamp: number;
  readonly text?: string;
  readonly attachment?: {
    readonly kind: "image" | "video" | "file";
    readonly fileName?: string;
    readonly sizeBytes?: number;
    /** Only set for images — a data: URL, never the original (token-bearing) download URL. */
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
  sendText: "chatter:send-text",
  pickAttachment: "chatter:pick-attachment",
  openAttachment: "chatter:open-attachment",
} as const;
