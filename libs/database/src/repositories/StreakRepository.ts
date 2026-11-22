import mongoose from "mongoose";

/**
 * Streaks are the Streaks plugin's, run by the Robtic Engine (Documents/plugins.md): each member's values live in the
 * plugin's storage (`pluginstore`, scope member: `streak`, `best`, `claimed` as a UTC day, `last_at`, `lost`,
 * `lost_until`) and its settings in `plugininstalls`. The bot only reads them, for /profile, the profile badges,
 * /top, the reward bonus and `!check streak`.
 */

const PLUGIN = "streaks";
const DAY_MS = 86_400_000;

/** One member's streak, as the bot's readers use it. */
export interface StreakView {
    discordId: string;
    guildId: string;
    currentStreak: number;
    bestStreak: number;
    active: boolean;
    /** The day of the last claim (its start, UTC). */
    lastIncrement: Date;
    lastMessageAt: Date;
    /** Until when staff can give a just-lost streak back; `null` when none is waiting. */
    pendingReturnUntil: Date | null;
    /** The streak waiting to be given back, 0 when none is. */
    lostStreak: number;
}

interface StoreDoc {
    memberId: string;
    data?: Record<string, unknown>;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const store = () => mongoose.connection.collection<StoreDoc>("pluginstore");
const scope = (guildId: string) => ({ guildId, pluginId: PLUGIN, scope: "member" });

function view(guildId: string, d: StoreDoc): StreakView {
    const data = d.data ?? {};
    const streak = num(data.streak);
    const lostUntil = num(data.lost_until);
    return {
        discordId: d.memberId,
        guildId,
        currentStreak: streak,
        bestStreak: num(data.best),
        active: streak > 0,
        lastIncrement: new Date(num(data.claimed) * DAY_MS),
        lastMessageAt: new Date(num(data.last_at) * 1000),
        pendingReturnUntil: lostUntil > 0 && num(data.lost) > 0 ? new Date(lostUntil * 1000) : null,
        lostStreak: num(data.lost),
    };
}

async function list(guildId: string, filter: Record<string, unknown>, sort: Record<string, 1 | -1>, limit = 0): Promise<StreakView[]> {
    const cur = store().find({ ...scope(guildId), ...filter }).sort(sort);
    if (limit) cur.limit(limit);
    return (await cur.toArray()).map(d => view(guildId, d));
}

export class StreakRepository {
    static async find(discordId: string, guildId: string): Promise<StreakView | null> {
        const d = await store().findOne({ ...scope(guildId), memberId: discordId });
        return d ? view(guildId, d) : null;
    }

    /** The member's streak, or an empty one (nothing is created: the plugin writes). */
    static async findOrCreate(discordId: string, guildId: string, _username: string): Promise<StreakView> {
        return (await StreakRepository.find(discordId, guildId)) ?? view(guildId, { memberId: discordId });
    }

    static async getCurrentLeaderboard(guildId: string, limit = 5): Promise<StreakView[]> {
        return list(guildId, { "data.streak": { $gt: 0 } }, { "data.streak": -1 }, limit);
    }

    static async getBestLeaderboard(guildId: string, limit = 5): Promise<StreakView[]> {
        return list(guildId, { "data.best": { $gt: 0 } }, { "data.best": -1 }, limit);
    }

    /** Best streak among members who claimed since `since` — backs /top's weekly/monthly streak periods. */
    static async getBestLeaderboardSince(guildId: string, since: Date, limit = 5): Promise<StreakView[]> {
        return list(guildId, { "data.best": { $gt: 0 }, "data.claimed": { $gte: Math.floor(since.getTime() / DAY_MS) } }, { "data.best": -1 }, limit);
    }

    static async getRank(discordId: string, guildId: string): Promise<number> {
        const user = await StreakRepository.find(discordId, guildId);
        if (!user || user.currentStreak <= 0) return -1;
        return (await store().countDocuments({ ...scope(guildId), "data.streak": { $gt: user.currentStreak } })) + 1;
    }

    static async getBestRank(discordId: string, guildId: string): Promise<number> {
        const user = await StreakRepository.find(discordId, guildId);
        if (!user || user.bestStreak <= 0) return -1;
        return (await store().countDocuments({ ...scope(guildId), "data.best": { $gt: user.bestStreak } })) + 1;
    }

    static async findAllActive(guildId: string): Promise<StreakView[]> {
        return list(guildId, { "data.streak": { $gt: 0 } }, { "data.streak": -1 });
    }

    static async countGuild(guildId: string): Promise<number> {
        return store().countDocuments(scope(guildId));
    }

    /** Every active streak whose current value equals `value` — backs the admin `!check streak <n>` lookup. */
    static async findByCurrentStreak(guildId: string, value: number): Promise<StreakView[]> {
        return list(guildId, { "data.streak": value }, { "data.claimed": -1 });
    }

    /** The plugin's windows on this server, in days and hours (its settings are in seconds). Defaults when unset. */
    static async windows(guildId: string): Promise<{ claimDays: number | null; expireDays: number | null; returnWindowHours: number | null }> {
        const install = await mongoose.connection.collection<{ settings?: Record<string, unknown> }>("plugininstalls").findOne({ guildId, pluginId: PLUGIN });
        const s = install?.settings ?? {};
        const days = (v: unknown) => (typeof v === "number" && v > 0 ? Math.round(v / 86_400) : null);
        return {
            claimDays: days(s.claim_every),
            expireDays: days(s.lost_after),
            returnWindowHours: typeof s.return_window === "number" ? Math.round(s.return_window / 3600) : null,
        };
    }
}
