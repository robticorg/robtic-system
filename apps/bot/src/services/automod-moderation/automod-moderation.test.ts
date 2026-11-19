import { describe, expect, test } from "bun:test";
import { parseRecord, processRecord, recordReason } from "./index";

const G = "123456789012345678";
const U = "234567890123456789";

describe("AutoMod moderation records", () => {
    test("parses what the engine sends", () => {
        const r = parseRecord(JSON.stringify({ guildId: G, userId: U, type: "warn", seconds: 0, reason: "", why: "Bad words", at: 1 }));
        expect(r?.type).toBe("warn");
    });
    test("drops malformed records", () => {
        expect(parseRecord("not json")).toBeNull();
        expect(parseRecord(JSON.stringify({ guildId: "x", userId: U, type: "warn" }))).toBeNull();
        expect(parseRecord(JSON.stringify({ guildId: G, userId: U, type: "ban" }))).toBeNull();
    });
    test("reason falls back to what was caught", () => {
        expect(recordReason({ guildId: G, userId: U, type: "warn", reason: "  ", why: "Spam" })).toBe("AutoMod · Spam");
        expect(recordReason({ guildId: G, userId: U, type: "warn", reason: "No ads" })).toBe("No ads");
    });
    test("skips what it must not record", async () => {
        const client = { user: { id: "1" } } as never;
        expect(await processRecord(client, undefined, { guildId: G, userId: U, type: "warn" })).toContain("not in that server");
        const guild = { id: G } as never;
        expect(await processRecord(client, guild, { guildId: G, userId: U, type: "warn", at: 1 }, 10 * 86_400)).toContain("too old");
        expect(await processRecord(client, guild, { guildId: G, userId: U, type: "timeout" })).toContain("engine");
    });
});
