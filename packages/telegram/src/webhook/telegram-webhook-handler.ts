import type { Update } from "@grammyjs/types";
import type { TelegramAccountAdapter } from "../adapter/telegram-account-adapter.js";

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

function hasDispatchableContent(message: Update["message"]): boolean {
  return (
    message?.text !== undefined ||
    message?.photo !== undefined ||
    message?.video !== undefined ||
    message?.document !== undefined ||
    message?.voice !== undefined ||
    message?.audio !== undefined
  );
}

/**
 * Framework-independent webhook handler (FR-002): a plain `Request -> Promise<Response>`
 * function any HTTP framework or Node's raw `http` module can wrap. Validates the secret
 * header before any request-body parsing (FR-003) — an unauthenticated request never
 * reaches Update parsing or dispatch.
 */
export function createTelegramWebhookHandler(
  adapter: TelegramAccountAdapter,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (!adapter.validateWebhookSecret(request.headers.get(SECRET_HEADER))) {
      return new Response(null, { status: 401 });
    }

    let update: Update;
    try {
      update = (await request.json()) as Update;
    } catch {
      return new Response(null, { status: 400 });
    }

    if (adapter.hasProcessedUpdate(update.update_id)) {
      // Telegram redelivered an update we've already dispatched — acknowledge it (so
      // Telegram doesn't keep retrying) without dispatching it again.
      return new Response(null, { status: 200 });
    }

    const message = update.message;
    if (hasDispatchableContent(message) && adapter.botUserId !== undefined && message) {
      try {
        const mapped = await adapter.mapInboundMessage(message);
        adapter.dispatchInbound(mapped);
      } catch (error) {
        // Resolving an attachment's download URL is a real network call (getFile) that can
        // fail — this must not crash the handler or leave the update unacknowledged (Telegram
        // would just retry). Surfaced non-fatally, same pattern as stop()'s cleanup failure.
        adapter.reportNonFatalError(
          `Failed to map inbound Telegram message: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    adapter.recordProcessedUpdate(update.update_id);

    return new Response(null, { status: 200 });
  };
}
