import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { Attachment, Chatter as ChatterType, Conversation, MessageCreatedEvent } from "@chatter/core";
import type { TelegramAccountAdapter as TelegramAccountAdapterType } from "@chatter/telegram";
import {
  dataUrlFromBuffer,
  fetchAttachmentBytes,
  kindFromMimeType,
  mimeTypeFromFileName,
  writeToTempFile,
} from "./attachment-utils.js";
import { IPC_CHANNELS, type MessageView, type StatusView } from "./ipc-types.js";

// @chatter/core and @chatter/telegram are ESM-only; this app is CommonJS (simplest, most
// compatible choice for Electron's preload/main ecosystem — see README). Dynamic import()
// works from CommonJS to load an ESM dependency, so that's used here instead of require().
async function loadChatter(): Promise<{
  Chatter: typeof ChatterType;
  TelegramAccountAdapter: typeof TelegramAccountAdapterType;
  createTelegramWebhookHandler: (
    adapter: TelegramAccountAdapterType,
  ) => (request: Request) => Promise<Response>;
}> {
  const core = await import("@chatter/core");
  const telegram = await import("@chatter/telegram");
  return {
    Chatter: core.Chatter,
    TelegramAccountAdapter: telegram.TelegramAccountAdapter,
    createTelegramWebhookHandler: telegram.createTelegramWebhookHandler,
  };
}

let mainWindow: BrowserWindow | undefined;
let chatter: ChatterType | undefined;
let httpServer: ReturnType<typeof createServer> | undefined;
let activeConversation: Conversation | undefined;
let messageCounter = 0;

/** Real Attachment objects (with the real download URL), keyed by message id — never sent to
 *  the renderer directly. See attachment-utils.ts's fetchAttachmentBytes() doc comment. */
const attachmentsById = new Map<string, Attachment>();

function sendToRenderer(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function sendStatus(text: string, level: StatusView["level"] = "info"): void {
  console.log(`[status:${level}] ${text}`);
  sendToRenderer(IPC_CHANNELS.status, { text, level } satisfies StatusView);
}

async function buildMessageView(
  direction: MessageView["direction"],
  sender: string,
  text: string | undefined,
  attachment: Attachment | undefined,
): Promise<MessageView> {
  messageCounter += 1;
  const id = `msg-${String(messageCounter)}`;

  if (attachment !== undefined) {
    attachmentsById.set(id, attachment);
  }

  let previewDataUrl: string | undefined;
  if (attachment?.kind === "image") {
    try {
      const data =
        "data" in attachment.source
          ? attachment.source.data
          : await fetchAttachmentBytes(attachment.source.url);
      previewDataUrl = dataUrlFromBuffer(data, attachment.mimeType);
    } catch (error) {
      sendStatus(`Failed to load image preview: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  return {
    id,
    direction,
    sender,
    timestamp: Date.now(),
    ...(text !== undefined ? { text } : {}),
    ...(attachment !== undefined
      ? {
          attachment: {
            kind: attachment.kind,
            ...(attachment.fileName !== undefined ? { fileName: attachment.fileName } : {}),
            ...(attachment.sizeBytes !== undefined ? { sizeBytes: attachment.sizeBytes } : {}),
            ...(previewDataUrl !== undefined ? { previewDataUrl } : {}),
          },
        }
      : {}),
  };
}

async function handleInbound(event: MessageCreatedEvent): Promise<void> {
  activeConversation = event.message.conversation;
  const attachment = event.message.attachments?.[0];
  const view = await buildMessageView(
    "inbound",
    event.message.sender.displayName ?? "Unknown",
    event.message.text,
    attachment,
  );
  sendToRenderer(IPC_CHANNELS.message, view);
}

function requireChatter(): ChatterType {
  if (chatter === undefined) {
    throw new Error("Chatter is not started yet");
  }
  return chatter;
}

function requireActiveConversation(): Conversation {
  if (activeConversation === undefined) {
    throw new Error("No conversation yet — wait for a message from Telegram first");
  }
  return activeConversation;
}

async function startChatter(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

  if (!botToken || !webhookSecret || !webhookUrl) {
    sendStatus(
      "Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and TELEGRAM_WEBHOOK_URL environment variables and restart.",
      "error",
    );
    return;
  }

  // Re-bind as explicitly-typed `string`: TS narrowing from the guard above doesn't carry
  // into the separately-declared `handleRequest` closure below.
  const registeredWebhookUrl: string = webhookUrl;

  const { Chatter, TelegramAccountAdapter, createTelegramWebhookHandler } = await loadChatter();

  const adapter = new TelegramAccountAdapter({ botToken, webhookSecret, webhookUrl });
  chatter = new Chatter({ accounts: [{ accountName: "chatter-desktop", adapter }] });
  const webhookHandler = createTelegramWebhookHandler(adapter);

  chatter.on("message.created", (event) => {
    handleInbound(event).catch((error: unknown) => {
      sendStatus(`Failed to process inbound message: ${error instanceof Error ? error.message : String(error)}`, "error");
    });
  });

  await chatter.start();

  const webhookPath = new URL(registeredWebhookUrl).pathname;
  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST" || req.url !== webhookPath) {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers.set(key, value);
      }
    }
    const response = await webhookHandler(
      new Request(registeredWebhookUrl, { method: "POST", headers, body: Buffer.concat(chunks) }),
    );
    res.writeHead(response.status);
    res.end(await response.text());
  }

  const port = Number(process.env.PORT ?? 3000);
  httpServer = createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      console.error("Failed to handle webhook request", error);
      res.writeHead(500).end();
    });
  });
  httpServer.listen(port, () => {
    sendStatus(`Listening on :${String(port)}, webhook path ${webhookPath}. Waiting for a message from Telegram...`);
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.sendText, async (_event, text: string) => {
    const conversation = requireActiveConversation();
    await requireChatter().send({ account: "chatter-desktop", conversation, text });
    const view = await buildMessageView("outbound", "You", text, undefined);
    sendToRenderer(IPC_CHANNELS.message, view);
  });

  ipcMain.handle(IPC_CHANNELS.pickAttachment, async (_event, caption: string) => {
    if (mainWindow === undefined) {
      return;
    }
    const conversation = requireActiveConversation();
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openFile"] });
    if (result.canceled || result.filePaths.length === 0) {
      return;
    }
    const filePath = result.filePaths[0];
    if (filePath === undefined) {
      return;
    }
    const { readFile } = await import("node:fs/promises");
    const data = await readFile(filePath);
    const fileName = filePath.split("/").pop() ?? filePath;
    const mimeType = mimeTypeFromFileName(fileName);
    const kind = kindFromMimeType(mimeType);
    const attachment: Attachment = {
      kind,
      source: { data },
      fileName,
      ...(mimeType !== undefined ? { mimeType } : {}),
      sizeBytes: data.byteLength,
    };

    await requireChatter().send({
      account: "chatter-desktop",
      conversation,
      ...(caption.length > 0 ? { text: caption } : {}),
      attachment,
    });
    const view = await buildMessageView(
      "outbound",
      "You",
      caption.length > 0 ? caption : undefined,
      attachment,
    );
    sendToRenderer(IPC_CHANNELS.message, view);
  });

  ipcMain.handle(IPC_CHANNELS.openAttachment, async (_event, messageId: string) => {
    const attachment = attachmentsById.get(messageId);
    if (attachment === undefined) {
      return;
    }
    const fileName = attachment.fileName ?? `attachment-${messageId}`;
    const data =
      "data" in attachment.source
        ? attachment.source.data
        : await fetchAttachmentBytes(attachment.source.url);
    const tempPath = await writeToTempFile(data, fileName);
    await shell.openPath(tempPath);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron's default sandboxed preload can only require() a small built-in allowlist —
      // not local files via a relative path, which preload.ts does (to share IPC_CHANNELS
      // with this file rather than duplicating the channel name strings). contextIsolation
      // above is what actually keeps the untrusted page content out of preload's privileged
      // scope; sandbox: false only affects what preload itself is allowed to require, and
      // this app only ever loads its own bundled, local index.html — never remote content.
      sandbox: false,
    },
  });
  // Forwards renderer-side console.log/error/warn (and any uncaught script error, which
  // Chromium also reports here) to this process's own terminal — this is a debugging aid
  // for a test client, not something a production app would normally do.
  mainWindow.webContents.on("console-message", (event) => {
    console.log(`[renderer:${event.level}] ${event.message} (${event.sourceId}:${String(event.lineNumber)})`);
  });
  mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.loadFile(join(__dirname, "../renderer/index.html")).catch((error: unknown) => {
    console.error("Failed to load renderer", error);
  });
}

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();
  // Wait for the renderer's script to actually attach its onStatus/onMessage listeners
  // before sending anything — webContents.send() before that point is silently dropped
  // (ipcRenderer.on() isn't a queue), which left the page stuck on its static "Starting…"
  // placeholder no matter what happened in startChatter().
  mainWindow?.webContents.once("did-finish-load", () => {
    startChatter().catch((error: unknown) => {
      sendStatus(`Failed to start: ${error instanceof Error ? error.message : String(error)}`, "error");
    });
  });
}).catch((error: unknown) => {
  console.error("Failed during startup", error);
});

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    await chatter?.stop();
  } catch (error) {
    console.error("Failed to stop Chatter cleanly", error);
  }
  await new Promise<void>((resolve) => {
    if (httpServer) {
      httpServer.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

app.on("window-all-closed", () => {
  shutdown()
    .then(() => {
      app.quit();
    })
    .catch(() => {
      app.quit();
    });
});

process.on("SIGINT", () => {
  shutdown()
    .then(() => {
      app.quit();
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
});
process.on("SIGTERM", () => {
  shutdown()
    .then(() => {
      app.quit();
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
});
