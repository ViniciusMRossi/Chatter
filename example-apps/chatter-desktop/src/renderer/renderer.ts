interface ConversationSummary {
  key: string;
  label: string;
}

interface MessageView {
  id: string;
  conversationKey: string;
  direction: "inbound" | "outbound";
  sender: string;
  timestamp: number;
  text?: string;
  attachment?: {
    kind: "image" | "video" | "file";
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    previewDataUrl?: string;
  };
}

interface StatusView {
  text: string;
  level: "info" | "error";
}

interface ChatterAPI {
  onMessage: (callback: (message: MessageView) => void) => void;
  onStatus: (callback: (status: StatusView) => void) => void;
  onConversations: (callback: (conversations: ConversationSummary[]) => void) => void;
  sendText: (conversationKey: string, text: string) => Promise<void>;
  pickAttachment: (conversationKey: string, caption: string) => Promise<void>;
  openAttachment: (messageId: string) => Promise<void>;
}

// Declaration merging with lib.dom.d.ts's global Window interface — not an unused
// declaration, even though eslint's static analysis can't see that.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Window {
  // Optional, not guaranteed: reflects that the preload script exposing this can fail to
  // run (wrong path, thrown error, etc.) — see the runtime check at the bottom of this file.
  chatterAPI?: ChatterAPI;
}

const messagesEl = document.getElementById("messages");
const statusEl = document.getElementById("status");
const conversationListEl = document.getElementById("conversation-list");
const conversationTitleEl = document.getElementById("conversation-title");
const textInput = document.getElementById("text-input") as HTMLInputElement | null;
const sendButton = document.getElementById("send-button") as HTMLButtonElement | null;
const attachButton = document.getElementById("attach-button") as HTMLButtonElement | null;

const conversations: ConversationSummary[] = [];
const messagesByConversation = new Map<string, MessageView[]>();
const unreadConversationKeys = new Set<string>();
let selectedConversationKey: string | undefined;

function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) {
    return "";
  }
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIconFor(kind: "image" | "video" | "file"): string {
  if (kind === "video") {
    return "🎬";
  }
  return "📄";
}

function setComposerEnabled(enabled: boolean): void {
  if (textInput !== null) {
    textInput.disabled = !enabled;
  }
  if (sendButton !== null) {
    sendButton.disabled = !enabled;
  }
  if (attachButton !== null) {
    attachButton.disabled = !enabled;
  }
}

function renderConversationList(): void {
  if (conversationListEl === null) {
    return;
  }
  conversationListEl.replaceChildren(
    ...conversations.map((conversation) => {
      const item = document.createElement("li");
      item.className = "conversation-item";
      item.classList.toggle("selected", conversation.key === selectedConversationKey);
      item.classList.toggle("has-unread", unreadConversationKeys.has(conversation.key));

      const dot = document.createElement("span");
      dot.className = "unread-dot";
      const label = document.createElement("span");
      label.textContent = conversation.label;
      item.append(dot, label);

      item.addEventListener("click", () => {
        selectConversation(conversation.key);
      });
      return item;
    }),
  );
}

function renderMessageBubble(message: MessageView): void {
  if (messagesEl === null) {
    return;
  }
  const bubble = document.createElement("div");
  bubble.className = `message ${message.direction}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  const senderSpan = document.createElement("span");
  senderSpan.className = "sender";
  senderSpan.textContent = message.sender;
  meta.append(senderSpan, document.createTextNode(` · ${new Date(message.timestamp).toLocaleTimeString()}`));
  bubble.append(meta);

  if (message.text !== undefined && message.text.length > 0) {
    const textEl = document.createElement("div");
    textEl.className = "message-text";
    textEl.textContent = message.text;
    bubble.append(textEl);
  }

  const attachment = message.attachment;
  if (attachment !== undefined) {
    const isAudio = attachment.mimeType?.startsWith("audio/") === true;
    if (attachment.kind === "image" && attachment.previewDataUrl !== undefined) {
      const img = document.createElement("img");
      img.className = "message-image";
      img.src = attachment.previewDataUrl;
      img.alt = attachment.fileName ?? "image attachment";
      bubble.append(img);
    } else if (isAudio && attachment.previewDataUrl !== undefined) {
      // Telegram voice messages and audio files both map to kind "file" (no separate "audio"
      // kind in @chatter/core) — mimeType is what distinguishes "play inline" from a generic
      // file chip. Receive-only: there's no attach-audio flow, per the request that added this.
      const audio = document.createElement("audio");
      audio.className = "message-audio";
      audio.controls = true;
      audio.src = attachment.previewDataUrl;
      bubble.append(audio);
    } else {
      const chip = document.createElement("div");
      chip.className = "file-chip";

      const icon = document.createElement("span");
      icon.className = "file-chip-icon";
      icon.textContent = fileIconFor(attachment.kind);

      const info = document.createElement("div");
      info.className = "file-chip-info";
      const name = document.createElement("div");
      name.className = "file-chip-name";
      name.textContent = attachment.fileName ?? "attachment";
      const size = document.createElement("div");
      size.className = "file-chip-size";
      size.textContent = formatSize(attachment.sizeBytes);
      info.append(name, size);

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.addEventListener("click", () => {
        window.chatterAPI?.openAttachment(message.id).catch((error: unknown) => {
          console.error("Failed to open attachment", error);
        });
      });

      chip.append(icon, info, openButton);
      bubble.append(chip);
    }
  }

  messagesEl.append(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function selectConversation(key: string): void {
  selectedConversationKey = key;
  unreadConversationKeys.delete(key);
  if (conversationTitleEl !== null) {
    conversationTitleEl.textContent = conversations.find((c) => c.key === key)?.label ?? key;
  }
  messagesEl?.replaceChildren();
  for (const message of messagesByConversation.get(key) ?? []) {
    renderMessageBubble(message);
  }
  setComposerEnabled(true);
  renderConversationList();
}

function handleConversations(updated: ConversationSummary[]): void {
  conversations.length = 0;
  conversations.push(...updated);
  if (selectedConversationKey === undefined && conversations.length > 0) {
    const first = conversations[0];
    if (first !== undefined) {
      selectConversation(first.key);
      return;
    }
  }
  renderConversationList();
}

function handleMessage(message: MessageView): void {
  const bucket = messagesByConversation.get(message.conversationKey) ?? [];
  bucket.push(message);
  messagesByConversation.set(message.conversationKey, bucket);

  if (message.conversationKey === selectedConversationKey) {
    renderMessageBubble(message);
  } else if (message.direction === "inbound") {
    unreadConversationKeys.add(message.conversationKey);
    renderConversationList();
  }
}

function setStatus(status: StatusView): void {
  if (statusEl === null) {
    return;
  }
  statusEl.textContent = status.text;
  statusEl.classList.toggle("error", status.level === "error");
}

function sendCurrentText(): void {
  if (selectedConversationKey === undefined || textInput === null || textInput.value.trim().length === 0) {
    return;
  }
  const text = textInput.value.trim();
  textInput.value = "";
  window.chatterAPI?.sendText(selectedConversationKey, text).catch((error: unknown) => {
    setStatus({ text: `Failed to send: ${String(error)}`, level: "error" });
  });
}

sendButton?.addEventListener("click", sendCurrentText);
textInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendCurrentText();
  }
});

attachButton?.addEventListener("click", () => {
  if (selectedConversationKey === undefined) {
    return;
  }
  const caption = textInput?.value.trim() ?? "";
  if (textInput !== null) {
    textInput.value = "";
  }
  window.chatterAPI?.pickAttachment(selectedConversationKey, caption).catch((error: unknown) => {
    setStatus({ text: `Failed to send attachment: ${String(error)}`, level: "error" });
  });
});

if (window.chatterAPI === undefined) {
  console.error("window.chatterAPI is undefined — the preload script did not run/expose it.");
  setStatus({ text: "Internal error: preload script did not load (see DevTools console).", level: "error" });
} else {
  window.chatterAPI.onMessage(handleMessage);
  window.chatterAPI.onStatus(setStatus);
  window.chatterAPI.onConversations(handleConversations);
}
