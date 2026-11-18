import { describe, expect, test } from "bun:test";
import { fillReply, inActiveHours, matchRule, pickReply } from "./match";

const rule = (triggers: string[], matchMode: "exact" | "word" | "contains" | "starts" | "ends" | "regex", caseSensitive = false) => ({ triggers, matchMode, caseSensitive });

describe("auto reply matcher", () => {
    test("whole words only, case-insensitive", () => {
        expect(matchRule(rule(["hello"], "word"), "Hello there", false)).not.toBeNull();
        expect(matchRule(rule(["hello"], "word"), "othello", false)).toBeNull();
    });
    test("Arabic words and normalization only when the language is Arabic", () => {
        expect(matchRule(rule(["سلام"], "word"), "السلام عليكم", true)).toBeNull();
        expect(matchRule(rule(["مرحبا"], "exact"), "مَرحباً", true)).not.toBeNull();
        expect(matchRule(rule(["مرحبا"], "exact"), "مَرحباً", false)).toBeNull();
    });
    test("regex on RE2 with groups; unsafe features never match", () => {
        const m = matchRule(rule(["^!ip\\s*(\\w+)?$"], "regex"), "!ip survival", false);
        expect(m?.groups[0]).toBe("survival");
        expect(matchRule(rule(["(a)\\1"], "regex"), "aa", false)).toBeNull();
        const t = Date.now();
        matchRule(rule(["(a+)+$"], "regex"), "a".repeat(900) + "b", false);
        expect(Date.now() - t).toBeLessThan(500);
    });
    test("variables", () => {
        const m = matchRule(rule(["^!ip\\s*(\\w+)?$"], "regex"), "!ip lobby", false);
        expect(fillReply("Hi {user} — IP for {1} on {server}", { userMention: "<@1>", userName: "Sara", server: "Robtic", channelMention: "<#2>", memberCount: 5 }, m)).toBe("Hi <@1> — IP for lobby on Robtic");
    });
    test("weights and no-repeat", () => {
        const replies = [{ text: "a", weight: 99, attachments: [] }, { text: "b", weight: 1, attachments: [] }];
        expect(pickReply(replies, true, false, null, () => 0.5)).toBe(0);
        expect(pickReply(replies, true, true, 0, () => 0.5)).toBe(1);
    });
    test("active hours wrap midnight", () => {
        expect(inActiveHours({ from: 22, to: 6 }, 23)).toBe(true);
        expect(inActiveHours({ from: 22, to: 6 }, 12)).toBe(false);
        expect(inActiveHours(null, 3)).toBe(true);
    });
});
