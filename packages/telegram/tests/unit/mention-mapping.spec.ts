import type { MessageEntity } from "@grammyjs/types";
import { describe, expect, it, vi } from "vitest";
import { mapMentions } from "../../src/mapping/mention.js";

/** The bot's own Telegram user id — `mapMessage` passes this through as providerAccountId. */
const BOT_USER_ID = "987654321";
const BOT_USERNAME = "chatter_test_bot";

function handleMention(offset: number, length: number): MessageEntity {
  return { type: "mention", offset, length };
}

function textMention(offset: number, length: number, userId: number, firstName: string): MessageEntity {
  return {
    type: "text_mention",
    offset,
    length,
    user: { id: userId, is_bot: false, first_name: firstName },
  };
}

describe("mapMentions() — structure and resolution (US1)", () => {
  it("maps a plain @handle to one mention carrying text and position", () => {
    const text = "hey @alice how are you";
    const mentions = mapMentions([handleMention(4, 6)], text, BOT_USER_ID, BOT_USERNAME);

    expect(mentions).toHaveLength(1);
    expect(mentions?.[0]?.text).toBe("@alice");
    expect(mentions?.[0]?.offset).toBe(4);
    expect(mentions?.[0]?.length).toBe(6);
  });

  it("maps a text_mention to a resolved Participant", () => {
    const text = "hey Alice Smith how are you";
    const mentions = mapMentions(
      [textMention(4, 11, 555, "Alice")],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions).toHaveLength(1);
    const participant = mentions?.[0]?.participant;
    expect(participant).toBeDefined();
    expect(participant?.provider).toBe("telegram");
    expect(participant?.providerParticipantId).toBe("555");
    expect(participant?.providerAccountId).toBe(BOT_USER_ID);
  });

  it("returns mentions in ascending offset order, one per reference", () => {
    const text = "@alice and @bob and @carol";
    const mentions = mapMentions(
      [handleMention(0, 6), handleMention(11, 4), handleMention(20, 6)],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions?.map((m) => m.text)).toEqual(["@alice", "@bob", "@carol"]);
    expect(mentions?.map((m) => m.offset)).toEqual([0, 11, 20]);
  });

  it("reports the same person twice as two separate mentions", () => {
    const text = "@alice ping @alice";
    const mentions = mapMentions(
      [handleMention(0, 6), handleMention(12, 6)],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions).toHaveLength(2);
    expect(mentions?.[0]?.offset).not.toBe(mentions?.[1]?.offset);
  });

  it("returns undefined — not an empty array — when there are no entities at all", () => {
    expect(mapMentions(undefined, "no mentions here", BOT_USER_ID, BOT_USERNAME)).toBeUndefined();
  });

  it("returns undefined when entities are present but none are mentions", () => {
    const entities: MessageEntity[] = [
      { type: "bold", offset: 0, length: 3 },
      { type: "url", offset: 4, length: 10 },
    ];
    expect(mapMentions(entities, "abc http://ex.com", BOT_USER_ID, BOT_USERNAME)).toBeUndefined();
  });

  it("ignores non-mention entity types interleaved with real mentions", () => {
    const text = "bold @alice link";
    const entities: MessageEntity[] = [
      { type: "bold", offset: 0, length: 4 },
      handleMention(5, 6),
      { type: "url", offset: 12, length: 4 },
    ];

    const mentions = mapMentions(entities, text, BOT_USER_ID, BOT_USERNAME);
    expect(mentions).toHaveLength(1);
    expect(mentions?.[0]?.text).toBe("@alice");
  });
});

describe("mapMentions() — the slice invariant across Unicode (US1, SC-003)", () => {
  // The single most important property in this feature: Telegram reports offsets in UTF-16
  // code units, which is what JS string indexing already uses. A code-point-based
  // implementation passes the ASCII case and fails the emoji one.
  it.each([
    ["plain ASCII", "hey @alice there", 4, 6],
    ["accented characters before the mention", "héllo Ádám @alice", 11, 6],
    ["an emoji before the mention", "👋 @alice", 3, 6],
    ["several emoji before the mention", "👋🎉 @alice", 5, 6],
    ["an emoji between two mentions", "@bob 👋 @alice", 8, 6],
  ])("holds for %s", (_label, text, offset, length) => {
    const mentions = mapMentions([handleMention(offset, length)], text, BOT_USER_ID, BOT_USERNAME);

    expect(mentions).toHaveLength(1);
    const mention = mentions?.[0];
    expect(mention).toBeDefined();
    if (mention === undefined) return;
    // The invariant itself, stated exactly as the contract states it.
    expect(text.slice(mention.offset, mention.offset + mention.length)).toBe(mention.text);
    expect(mention.text).toBe("@alice");
  });
});

describe("mapMentions() — never fabricates an identity (US1, FR-007/SC-004)", () => {
  it("leaves participant strictly undefined for an @handle mention", () => {
    const mentions = mapMentions([handleMention(0, 6)], "@alice", BOT_USER_ID, BOT_USERNAME);

    expect(mentions?.[0]?.participant).toBeUndefined();
    expect("participant" in (mentions?.[0] ?? {})).toBe(false);
  });

  it("does not stuff the handle into a synthesized participant id", () => {
    const mentions = mapMentions([handleMention(0, 6)], "@alice", BOT_USER_ID, BOT_USERNAME);

    expect(JSON.stringify(mentions)).not.toContain("providerParticipantId");
    expect(JSON.stringify(mentions)).not.toContain("alice\":");
  });
});

describe("mapMentions() — malformed provider payloads (US1, FR-015)", () => {
  it("skips an entity whose offset is negative", () => {
    const mentions = mapMentions([handleMention(-1, 6)], "@alice", BOT_USER_ID, BOT_USERNAME);
    expect(mentions).toBeUndefined();
  });

  it("skips an entity that runs past the end of the text", () => {
    const mentions = mapMentions([handleMention(0, 99)], "@alice", BOT_USER_ID, BOT_USERNAME);
    expect(mentions).toBeUndefined();
  });

  it("skips an entity with a negative length", () => {
    const mentions = mapMentions([handleMention(0, -3)], "@alice", BOT_USER_ID, BOT_USERNAME);
    expect(mentions).toBeUndefined();
  });

  it("skips only the malformed entity, keeping the valid ones", () => {
    const text = "@alice and @bob";
    const mentions = mapMentions(
      [handleMention(0, 6), handleMention(11, 99), handleMention(11, 4)],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions?.map((m) => m.text)).toEqual(["@alice", "@bob"]);
  });

  it("does not clamp a malformed entity into a plausible-looking mention", () => {
    const mentions = mapMentions([handleMention(0, 99)], "@alice", BOT_USER_ID, BOT_USERNAME);
    // Clamping would produce a mention with text "@alice" — indistinguishable from a real
    // one. Omission is the only honest outcome.
    expect(mentions).toBeUndefined();
  });

  it("reports a malformed entity through the non-fatal channel when one is supplied", () => {
    const onMalformed = vi.fn();
    mapMentions([handleMention(0, 99)], "@alice", BOT_USER_ID, BOT_USERNAME, onMalformed);

    expect(onMalformed).toHaveBeenCalledTimes(1);
    expect(String(onMalformed.mock.calls[0]?.[0])).toContain("mention");
  });

  it("returns undefined when the message has no text but entities are somehow present", () => {
    expect(mapMentions([handleMention(0, 6)], undefined, BOT_USER_ID, BOT_USERNAME)).toBeUndefined();
  });
});

describe("mapMentions() — recognizing the connected account (US2)", () => {
  it("marks a text_mention of the bot's own user id as self", () => {
    const text = "hey Test Bot";
    const mentions = mapMentions(
      [textMention(4, 8, Number(BOT_USER_ID), "Test Bot")],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions?.[0]?.isSelf).toBe(true);
  });

  it("does not mark a text_mention of a different user as self", () => {
    const text = "hey Alice Smith";
    const mentions = mapMentions(
      [textMention(4, 11, 555, "Alice")],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions?.[0]?.isSelf).toBe(false);
  });

  it("marks an @handle matching the bot's username as self", () => {
    const text = `hey @${BOT_USERNAME} hello`;
    const mentions = mapMentions(
      [handleMention(4, BOT_USERNAME.length + 1)],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions?.[0]?.isSelf).toBe(true);
    // Still unresolved — recognizing ourselves does not mean we can mint a participant.
    expect(mentions?.[0]?.participant).toBeUndefined();
  });

  it("does not mark an @handle for someone else as self", () => {
    const mentions = mapMentions([handleMention(0, 6)], "@alice", BOT_USER_ID, BOT_USERNAME);
    expect(mentions?.[0]?.isSelf).toBe(false);
  });

  it("compares usernames case-insensitively, as Telegram does", () => {
    const text = "@ChAtTeR_TeSt_BoT hi";
    const mentions = mapMentions([handleMention(0, 17)], text, BOT_USER_ID, BOT_USERNAME);

    expect(mentions?.[0]?.text).toBe("@ChAtTeR_TeSt_BoT");
    expect(mentions?.[0]?.isSelf).toBe(true);
  });

  it("never matches the handle form when the bot has no username, without throwing", () => {
    const text = `hey @${BOT_USERNAME}`;
    const mentions = mapMentions(
      [handleMention(4, BOT_USERNAME.length + 1)],
      text,
      BOT_USER_ID,
      undefined,
    );

    expect(mentions).toHaveLength(1);
    expect(mentions?.[0]?.isSelf).toBe(false);
  });

  it("marks exactly one mention as self when the bot and others are mentioned together", () => {
    const text = `@alice @${BOT_USERNAME} @bob`;
    const botStart = 7;
    const mentions = mapMentions(
      [
        handleMention(0, 6),
        handleMention(botStart, BOT_USERNAME.length + 1),
        handleMention(botStart + BOT_USERNAME.length + 2, 4),
      ],
      text,
      BOT_USER_ID,
      BOT_USERNAME,
    );

    expect(mentions).toHaveLength(3);
    expect(mentions?.filter((m) => m.isSelf)).toHaveLength(1);
    expect(mentions?.find((m) => m.isSelf)?.text).toBe(`@${BOT_USERNAME}`);
  });

  it("always reports isSelf as a real boolean, never undefined", () => {
    const mentions = mapMentions([handleMention(0, 6)], "@alice", BOT_USER_ID, BOT_USERNAME);
    expect(typeof mentions?.[0]?.isSelf).toBe("boolean");
  });
});

describe("mapMentions() — /command@botname is not a mention (US2, FR-017)", () => {
  // Pins the decision recorded in spec.md FR-017 and research.md §3. If this test starts
  // failing, that is a deliberate specification change, not a bug to fix in the mapper:
  // Telegram marks this a command, and synthesizing a mention from it would mean parsing
  // message text ourselves, which FR-014 forbids.
  it("produces no mention for a command addressed to this bot", () => {
    const text = `/start@${BOT_USERNAME}`;
    const entities: MessageEntity[] = [{ type: "bot_command", offset: 0, length: text.length }];

    expect(mapMentions(entities, text, BOT_USER_ID, BOT_USERNAME)).toBeUndefined();
  });

  it("produces no self signal for a command addressed to this bot", () => {
    const text = `/start@${BOT_USERNAME} now`;
    const entities: MessageEntity[] = [{ type: "bot_command", offset: 0, length: 7 + BOT_USERNAME.length }];

    const mentions = mapMentions(entities, text, BOT_USER_ID, BOT_USERNAME);
    expect(mentions?.some((m) => m.isSelf)).not.toBe(true);
  });

  it("still maps a real mention that appears alongside a command", () => {
    const text = `/start@${BOT_USERNAME} @alice`;
    const aliceOffset = 7 + BOT_USERNAME.length + 1;
    const entities: MessageEntity[] = [
      { type: "bot_command", offset: 0, length: 7 + BOT_USERNAME.length },
      handleMention(aliceOffset, 6),
    ];

    const mentions = mapMentions(entities, text, BOT_USER_ID, BOT_USERNAME);
    expect(mentions).toHaveLength(1);
    expect(mentions?.[0]?.text).toBe("@alice");
    expect(mentions?.[0]?.isSelf).toBe(false);
  });
});
