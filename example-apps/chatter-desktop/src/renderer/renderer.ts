interface MessageView {
  id: string;
  direction: "inbound" | "outbound";
  sender: string;
  timestamp: number;
  text?: string;
  attachment?: {
    kind: "image" | "video" | "file";
    fileName?: string;
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
  sendText: (text: string) => Promise<void>;
  pickAttachment: (caption: string) => Promise<void>;
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
const textInput = document.getElementById("text-input") as HTMLInputElement | null;
const sendButton = document.getElementById("send-button");
const attachButton = document.getElementById("attach-button");

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

function renderMessage(message: MessageView): void {
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
    if (attachment.kind === "image" && attachment.previewDataUrl !== undefined) {
      const img = document.createElement("img");
      img.className = "message-image";
      img.src = attachment.previewDataUrl;
      img.alt = attachment.fileName ?? "image attachment";
      bubble.append(img);
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

function setStatus(status: StatusView): void {
  if (statusEl === null) {
    return;
  }
  statusEl.textContent = status.text;
  statusEl.classList.toggle("error", status.level === "error");
}

function sendCurrentText(): void {
  if (textInput === null || textInput.value.trim().length === 0) {
    return;
  }
  const text = textInput.value.trim();
  textInput.value = "";
  window.chatterAPI?.sendText(text).catch((error: unknown) => {
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
  const caption = textInput?.value.trim() ?? "";
  if (textInput !== null) {
    textInput.value = "";
  }
  window.chatterAPI?.pickAttachment(caption).catch((error: unknown) => {
    setStatus({ text: `Failed to send attachment: ${String(error)}`, level: "error" });
  });
});

if (window.chatterAPI === undefined) {
  console.error("window.chatterAPI is undefined — the preload script did not run/expose it.");
  setStatus({ text: "Internal error: preload script did not load (see DevTools console).", level: "error" });
} else {
  window.chatterAPI.onMessage(renderMessage);
  window.chatterAPI.onStatus(setStatus);
}
