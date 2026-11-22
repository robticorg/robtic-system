import { describe, expect, test } from "bun:test";
import { parsePointsRecord, payRecord } from "./index";

const G = "123456789012345678";
const U = "234567890123456789";
const ok = { id: "a1", guildId: G, userId: U, pluginId: "streaks", amount: 5, reason: "Daily streak", at: 1 };

describe("plugin points records", () => {
    test("parses what the engine sends", () => {
        expect(parsePointsRecord(JSON.stringify(ok))?.amount).toBe(5);
    });
    test("drops malformed records", () => {
        expect(parsePointsRecord("nope")).toBeNull();
        expect(parsePointsRecord(JSON.stringify({ ...ok, id: "" }))).toBeNull();
        expect(parsePointsRecord(JSON.stringify({ ...ok, amount: -3 }))).toBeNull();
        expect(parsePointsRecord(JSON.stringify({ ...ok, pluginId: "Bad Id!" }))).toBeNull();
        expect(parsePointsRecord(JSON.stringify({ ...ok, userId: "x" }))).toBeNull();
    });
    test("skips what it must not pay", async () => {
        const client = { guilds: { cache: new Map() } } as never;
        expect(await payRecord(client, ok)).toContain("not in that server");
        const inGuild = { guilds: { cache: new Map([[G, {}]]) } } as never;
        expect(await payRecord(inGuild, ok, 10 * 86_400)).toContain("too old");
    });
});
