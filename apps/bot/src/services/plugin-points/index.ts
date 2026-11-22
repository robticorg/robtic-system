import IORedis from "ioredis";
import type { Client } from "discord.js";
import { onShutdown } from "@internal-api";
import { Logger } from "@logger";
import { isRedisConfigured } from "@queue";
import { PointsRepository } from "@database/repositories";

// Robtic Rules plugins run in the Robtic Engine. Their `give points` lands on a Redis list; this consumer pays it
// into the server's Points, with the plugin named on the ledger. Like AutoMod's moderation list, nothing waits for
// the bot: while it's down the list grows and is worked through when it's back.

const CTX = "plugin-points";
export const PLUGIN_POINTS_QUEUE = "robtic:plugins:points";
/** One `give points` pays at most this much: a broken plugin can't flood the economy. */
export const MAX_PER_RECORD = 1000;
/** Older records are dropped. */
const MAX_AGE_SECONDS = 2 * 86_400;

export interface PluginPointsRecord {
    /** Unique per `give points`: a record seen twice pays once. */
    id: string;
    guildId: string;
    userId: string;
    pluginId: string;
    amount: number;
    reason?: string | null;
    at?: number;
}

export function parsePointsRecord(raw: string): PluginPointsRecord | null {
    try {
        const r = JSON.parse(raw) as Partial<PluginPointsRecord>;
        if (typeof r.id !== "string" || !r.id || typeof r.pluginId !== "string" || !/^[a-z0-9-]{1,64}$/.test(r.pluginId)) return null;
        if (typeof r.guildId !== "string" || typeof r.userId !== "string") return null;
        if (!/^\d{15,22}$/.test(r.guildId) || !/^\d{15,22}$/.test(r.userId)) return null;
        if (typeof r.amount !== "number" || !Number.isFinite(r.amount) || r.amount <= 0) return null;
        return r as PluginPointsRecord;
    } catch {
        return null;
    }
}

/** One record → one ledger row. Returns what happened, for the log. */
export async function payRecord(client: Client, r: PluginPointsRecord, now = Date.now() / 1000): Promise<string> {
    if (!client.guilds.cache.has(r.guildId)) return "skipped (not in that server)";
    if (r.at && now - r.at > MAX_AGE_SECONDS) return "skipped (too old)";
    const amount = Math.min(Math.round(r.amount), MAX_PER_RECORD);
    if (amount <= 0) return "skipped (nothing to pay)";
    const username = (await client.users.fetch(r.userId).catch(() => null))?.username ?? r.userId;
    const reason = r.reason?.trim();
    await PointsRepository.move({
        guildId: r.guildId,
        discordId: r.userId,
        username,
        amount,
        source: "plugin",
        detail: (reason ? `${r.pluginId}: ${reason}` : r.pluginId).slice(0, 200),
        idempotencyKey: `plugin:${r.id}`,
    });
    return `paid ${amount}`;
}

/** Starts working through the plugins' points list once the Gateway leads. No-op without Redis. */
export function startPluginPoints(client: Client): void {
    if (!isRedisConfigured()) {
        Logger.info("REDIS_URL not set — plugin points not consumed", CTX);
        return;
    }
    const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null, lazyConnect: false });
    redis.on("error", err => Logger.warn(`Redis: ${err.message}`, CTX));
    let running = true;

    const loop = async () => {
        while (running) {
            let raw: string | null = null;
            try {
                const res = await redis.brpop(PLUGIN_POINTS_QUEUE, 5);
                raw = res?.[1] ?? null;
            } catch (err) {
                if (!running) break;
                Logger.warn(`reading the queue failed: ${(err as Error).message}`, CTX);
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }
            if (!raw) continue;
            const record = parsePointsRecord(raw);
            if (!record) {
                Logger.warn("dropped a malformed plugin points record", CTX);
                continue;
            }
            try {
                const result = await payRecord(client, record);
                Logger.info(`guildId=${record.guildId} userId=${record.userId} plugin=${record.pluginId} ${result}`, CTX);
            } catch (err) {
                Logger.warn(`guildId=${record.guildId} userId=${record.userId} plugin=${record.pluginId} failed: ${(err as Error).message}`, CTX);
            }
        }
    };
    void loop();

    onShutdown("plugin points", async () => {
        running = false;
        redis.disconnect();
    });
    Logger.success("Plugin points consumer started", CTX);
}
