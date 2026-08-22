import type { AccountAdapter, InboundEvent, SendInput } from "../adapter/adapter.js";
import { ChatterConfigurationError } from "../errors/chatter-configuration-error.js";
import type { Capability } from "../types/capability.js";
import type { DeliveryResult } from "../types/delivery-result.js";
import type { MessageCreatedEvent, MessageEditedEvent } from "../types/event.js";
import type { Message } from "../types/message.js";

export interface RegisteredAccountConfig {
  readonly accountName: string;
  readonly adapter: AccountAdapter;
}

export interface ChatterConfig {
  readonly accounts: RegisteredAccountConfig[];
}

export type ChatterSendInput = SendInput & { readonly account: string };

export interface LifecycleEvent {
  readonly phase: "started" | "stopped";
}

export interface OutboundEvent {
  readonly account: string;
  readonly result: DeliveryResult;
}

export interface ErrorEvent {
  readonly scope: "handler";
  readonly account?: string;
  readonly error: unknown;
}

interface ChatterEventMap {
  "message.created": MessageCreatedEvent;
  "message.edited": MessageEditedEvent;
  lifecycle: LifecycleEvent;
  outbound: OutboundEvent;
  error: ErrorEvent;
}

type Handler<K extends keyof ChatterEventMap> = (
  payload: ChatterEventMap[K],
) => void | Promise<void>;

type State = "created" | "started" | "stopped";

export class Chatter {
  #accounts: Map<string, AccountAdapter>;
  #listeners = new Map<keyof ChatterEventMap, Set<Handler<keyof ChatterEventMap>>>();
  #state: State = "created";

  constructor(config: ChatterConfig) {
    const accounts = new Map<string, AccountAdapter>();
    for (const { accountName, adapter } of config.accounts) {
      if (accounts.has(accountName)) {
        throw new ChatterConfigurationError(`duplicate account name: ${accountName}`);
      }
      accounts.set(accountName, adapter);
    }
    this.#accounts = accounts;
  }

  async start(): Promise<void> {
    if (this.#state === "started") {
      return;
    }
    for (const [accountName, adapter] of this.#accounts) {
      await adapter.start((event) => {
        this.#dispatchInbound(accountName, event);
      });
    }
    this.#state = "started";
    this.#dispatch("lifecycle", { phase: "started" });
  }

  async stop(): Promise<void> {
    if (this.#state !== "started") {
      this.#state = "stopped";
      return;
    }
    for (const adapter of this.#accounts.values()) {
      await adapter.stop();
    }
    this.#state = "stopped";
    this.#dispatch("lifecycle", { phase: "stopped" });
  }

  on<K extends keyof ChatterEventMap>(event: K, handler: Handler<K>): void {
    const set = this.#listeners.get(event) ?? new Set<Handler<keyof ChatterEventMap>>();
    set.add(handler as Handler<keyof ChatterEventMap>);
    this.#listeners.set(event, set);
  }

  off<K extends keyof ChatterEventMap>(event: K, handler: Handler<K>): void {
    this.#listeners.get(event)?.delete(handler as Handler<keyof ChatterEventMap>);
  }

  async send(input: ChatterSendInput): Promise<DeliveryResult> {
    if (this.#state !== "started") {
      throw new ChatterConfigurationError("Chatter must be started before sending messages");
    }
    const adapter = this.#accounts.get(input.account);
    if (!adapter) {
      throw new ChatterConfigurationError(`unknown account: ${input.account}`);
    }

    const sendInput: SendInput = {
      conversation: input.conversation,
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.attachment !== undefined ? { attachment: input.attachment } : {}),
      ...(input.replyToMessageId !== undefined ? { replyToMessageId: input.replyToMessageId } : {}),
    };
    const result = await adapter.send(sendInput);
    const deliveryResult: DeliveryResult = { ...result, account: input.account };
    this.#dispatch("outbound", { account: input.account, result: deliveryResult });
    return deliveryResult;
  }

  getCapabilities(accountName: string): ReadonlySet<Capability> {
    const adapter = this.#accounts.get(accountName);
    if (!adapter) {
      throw new ChatterConfigurationError(`unknown account: ${accountName}`);
    }
    return adapter.getCapabilities();
  }

  #dispatchInbound(accountName: string, event: InboundEvent): void {
    if (this.#state !== "started") {
      return;
    }
    const message: Message = { ...event.message, account: accountName };
    // Each inbound kind goes to its OWN listener set. An edit must never reach a
    // "message.created" handler: every application written before edits existed appends or
    // acts on whatever arrives there, so routing edits through it would make all of them
    // double-handle with nothing to tell the two cases apart.
    this.#dispatch(event.kind, {
      type: event.kind,
      account: accountName,
      message,
    });
  }

  #dispatch<K extends keyof ChatterEventMap>(event: K, payload: ChatterEventMap[K]): void {
    if (event === "error") {
      this.#dispatchError(payload as ErrorEvent);
      return;
    }
    const set = this.#listeners.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.#dispatchError({ scope: "handler", error });
          });
        }
      } catch (error) {
        this.#dispatchError({ scope: "handler", error });
      }
    }
  }

  #dispatchError(payload: ErrorEvent): void {
    const set = this.#listeners.get("error");
    if (!set) {
      return;
    }
    for (const handler of set) {
      try {
        void handler(payload);
      } catch {
        // Error handlers must never be able to crash dispatch or recurse back into this path.
      }
    }
  }
}
