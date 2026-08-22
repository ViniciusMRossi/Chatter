import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { InboundMessage } from "@chatter/core";
import { TelegramAccountAdapter } from "../../src/adapter/telegram-account-adapter.js";
import { createTelegramWebhookHandler } from "../../src/webhook/telegram-webhook-handler.js";
import { StubTelegramTransport } from "../support/stub-transport.js";

/**
 * Backs the `local-webhook/` folder of bruno/telegram-adapter/ during CI runs
 * (`pnpm run test:bruno`, see tests/bruno/run.sh). Uses the same
 * StubTelegramTransport as the Vitest integration tests — zero real Telegram
 * credentials or network access, matching this project's standing CI rule.
 *
 * Exposes two extra, test-only endpoints so Bruno's `tests` blocks can assert
 * on what was actually dispatched, not just HTTP status codes — this is what
 * lets the collection prove dedup, webhook-security, and mention-mapping
 * behavior rather than just "the server responded":
 *
 * - GET /received-count  -> { count }
 * - GET /last-message    -> the most recently dispatched normalized message
 *
 * /last-message exists because a mention assertion is otherwise untestable
 * here: "a bot command is not a mention" (specs/006-mentions FR-017) produces
 * exactly the same 200 as every other delivery, so status alone cannot tell a
 * correct mapping from a broken one.
 */

const PORT = Number(process.env.PORT ?? 3300);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "ci-test-webhook-secret";

const transport = new StubTelegramTransport();
const adapter = new TelegramAccountAdapter(
  {
    botToken: "ci-test-token",
    webhookSecret: WEBHOOK_SECRET,
    webhookUrl: `http://localhost:${String(PORT)}/telegram-webhook`,
  },
  { api: transport.api },
);

const received: InboundMessage[] = [];
await adapter.start((message) => {
  received.push(message);
});

const webhookHandler = createTelegramWebhookHandler(adapter);

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "GET" && req.url === "/received-count") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ count: received.length }));
    return;
  }

  if (req.method === "GET" && req.url === "/last-message") {
    res.writeHead(200, { "content-type": "application/json" });
    // `mentions` is absent rather than empty when a message references no one, so it
    // serializes to a missing key — which is exactly what the collection asserts against.
    res.end(JSON.stringify(received[received.length - 1] ?? null));
    return;
  }

  const body = await readBody(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const response = await webhookHandler(
    new Request(`http://localhost:${String(PORT)}${req.url ?? "/"}`, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    }),
  );

  res.writeHead(response.status);
  res.end(await response.text());
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error: unknown) => {
    console.error("Failed to handle request", error);
    res.writeHead(500).end();
  });
});

server.listen(PORT, () => {
  console.log(`READY on :${String(PORT)}`);
});
