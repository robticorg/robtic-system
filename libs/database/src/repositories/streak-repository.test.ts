import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { StreakRepository } from "./StreakRepository";

// Against a real MongoDB: TEST_MONGO=mongodb://… bun test. Skipped without it.
const uri = process.env.TEST_MONGO;
const G = "123456789012345678";

describe.skipIf(!uri)("streaks read from the Streaks plugin's storage", () => {
    beforeAll(async () => {
        await mongoose.connect(uri!, { dbName: "streak_repo_test" });
        await mongoose.connection.dropDatabase();
        const store = mongoose.connection.collection("pluginstore");
        await store.insertMany([
            { guildId: G, pluginId: "streaks", scope: "member", memberId: "a", data: { streak: 5, best: 9, claimed: 20_000, last_at: 1_728_000_000 } },
            { guildId: G, pluginId: "streaks", scope: "member", memberId: "b", data: { streak: 7, best: 7, claimed: 20_001 } },
            { guildId: G, pluginId: "streaks", scope: "member", memberId: "c", data: { best: 3, lost: 4, lost_until: Math.floor(Date.now() / 1000) + 3600 } },
            { guildId: G, pluginId: "boosts", scope: "member", memberId: "x", data: { streak: 99 } },
        ]);
        await mongoose.connection.collection("plugininstalls").insertOne({ guildId: G, pluginId: "streaks", settings: { claim_every: 86_400, lost_after: 172_800, return_window: 86_400 } });
    });
    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    test("a member's streak, and an empty one for nobody", async () => {
        const a = (await StreakRepository.find("a", G))!;
        expect([a.currentStreak, a.bestStreak, a.active, a.lastIncrement.getTime()]).toEqual([5, 9, true, 20_000 * 86_400_000]);
        expect((await StreakRepository.findOrCreate("z", G, "z")).currentStreak).toBe(0);
    });
    test("ranks and leaderboards (other plugins' data ignored)", async () => {
        expect(await StreakRepository.getRank("a", G)).toBe(2);
        expect(await StreakRepository.getBestRank("a", G)).toBe(1);
        expect(await StreakRepository.getRank("c", G)).toBe(-1);
        expect((await StreakRepository.getCurrentLeaderboard(G)).map(s => s.discordId)).toEqual(["b", "a"]);
        expect((await StreakRepository.getBestLeaderboardSince(G, new Date(20_001 * 86_400_000))).map(s => s.discordId)).toEqual(["b"]);
        expect(await StreakRepository.countGuild(G)).toBe(3);
    });
    test("a lost streak waiting to be given back, and the plugin's windows", async () => {
        const c = (await StreakRepository.find("c", G))!;
        expect([c.lostStreak, c.pendingReturnUntil !== null]).toEqual([4, true]);
        expect(await StreakRepository.windows(G)).toEqual({ claimDays: 1, expireDays: 2, returnWindowHours: 24 });
    });
});
