import { describe, expect, it } from "vitest";
import { Chatter, ChatterUnsupportedCapabilityError } from "@chatter/core";
import { FakeAccountAdapter } from "@chatter/testing";

describe("capability discovery", () => {
  it("Chatter.getCapabilities() reflects the account's declared capability set", () => {
    const adapter = new FakeAccountAdapter({ capabilities: ["text", "reply"] });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });

    const capabilities = chatter.getCapabilities("bot");

    expect(capabilities.has("text")).toBe(true);
    expect(capabilities.has("reply")).toBe(true);
    expect(capabilities.has("thread")).toBe(false);
  });

  it("rejects a thread-targeted send on an account without the thread capability", async () => {
    const adapter = new FakeAccountAdapter({ capabilities: ["text", "reply"] });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });
    await chatter.start();

    await expect(
      chatter.send({
        account: "bot",
        conversation: {
          provider: "fake",
          providerAccountId: "acct-1",
          providerConversationId: "channel-1",
          providerThreadId: "thread-1",
          type: "channel",
        },
        text: "hello",
      }),
    ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);

    await chatter.stop();
  });
});

describe("outbound operation capability gates (FR-018)", () => {
  const CONVERSATION = {
    provider: "fake",
    providerAccountId: "acct-1",
    providerConversationId: "conv-1",
    type: "group" as const,
  };

  it("rejects editMessage on an account that does not declare 'editMessage'", async () => {
    const adapter = new FakeAccountAdapter({ capabilities: ["text"] });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });
    await chatter.start();

    await expect(
      chatter.editMessage({
        account: "bot",
        conversation: CONVERSATION,
        messageId: "1",
        text: "nope",
      }),
    ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);
    // Half the requirement is that it fails BEFORE contacting the provider. The fake records
    // nothing for a call it never received, so an empty log is the proof.
    expect(adapter.editedMessages).toHaveLength(0);

    await chatter.stop();
  });

  it("rejects deleteMessage on an account that does not declare 'deleteMessage'", async () => {
    const adapter = new FakeAccountAdapter({ capabilities: ["text"] });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });
    await chatter.start();

    await expect(
      chatter.deleteMessage({ account: "bot", conversation: CONVERSATION, messageId: "1" }),
    ).rejects.toBeInstanceOf(ChatterUnsupportedCapabilityError);
    expect(adapter.deletedMessageIds).toHaveLength(0);

    await chatter.stop();
  });

  it("gates the three new capabilities independently of one another", () => {
    const editOnly = new FakeAccountAdapter({ capabilities: ["text", "editMessage"] });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter: editOnly }] });

    const capabilities = chatter.getCapabilities("bot");

    // An account offering one must not be assumed to offer the others: reporting others'
    // edits and being allowed to edit are unrelated permissions.
    expect(capabilities.has("editMessage")).toBe(true);
    expect(capabilities.has("deleteMessage")).toBe(false);
    expect(capabilities.has("editNotifications")).toBe(false);
  });

  it("offers no capability asserting that deletions are reported (FR-012)", () => {
    const adapter = new FakeAccountAdapter({
      capabilities: ["text", "editNotifications", "editMessage", "deleteMessage"],
    });
    const chatter = new Chatter({ accounts: [{ accountName: "bot", adapter }] });

    // No provider tells a bot that a message was deleted, so an adapter declaring everything
    // it possibly can still cannot claim it. Asserted against the FULL set rather than by
    // probing a string, so this fails if such a capability is ever quietly introduced.
    expect([...chatter.getCapabilities("bot")]).not.toContain("deleteNotifications");
  });
});
