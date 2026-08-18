import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Chatter } from "@chatter/core";
import { createTelegramWebhookHandler, TelegramAccountAdapter } from "@chatter/telegram";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

if (!botToken || !webhookSecret || !webhookUrl) {
  console.error(
    "Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and TELEGRAM_WEBHOOK_URL environment variables.",
  );
  process.exit(1);
}

// Re-bind as explicitly-typed `string` constants: TS narrowing from the guard above doesn't
// carry into the separately-declared `handleRequest` function below.
const registeredWebhookUrl: string = webhookUrl;

const adapter = new TelegramAccountAdapter({ botToken, webhookSecret, webhookUrl });
const chatter = new Chatter({ accounts: [{ accountName: "echo-bot", adapter }] });
const webhookHandler = createTelegramWebhookHandler(adapter);

// The exact same handler shape works regardless of whether it's a direct chat or a group
// chat — no Telegram-specific branching here at all.
chatter.on("message.created", async (event) => {
  console.log(
    `[${event.message.conversation.type}] ${event.message.sender.displayName ?? "?"}: ${event.message.text}`,
  );
  await chatter.send({
    account: event.account,
    conversation: event.message.conversation,
    text: `echo: ${event.message.text}`,
    replyToMessageId: event.message.id,
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
const server = createServer((req, res) => {
  handleRequest(req, res).catch((error: unknown) => {
    console.error("Failed to handle webhook request", error);
    res.writeHead(500).end();
  });
});

server.listen(port, () => {
  console.log(`telegram-echo listening on :${String(port)}, webhook path ${webhookPath}`);
});
