import IORedis from "ioredis";
import type { Client, Guild } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { onShutdown } from "@internal-api";
import { Logger } from "@logger";
import { isRedisConfigured } from "@queue";
import { executeWarn } from "@bot/commands/guild/admin/moderation/warn.command";
import { executeMute, MUTE_MAX_HOURS } from "@bot/commands/guild/admin/moderation/mute.command";
import { executeBan } from "@bot/commands/guild/admin/moderation/jail.command";

// AutoMod runs in the Robtic Engine (its own service, robticorg/robtic-engine). The engine deletes, times out and
// alerts by itself; warn / mute / jail belong to this bot's moderation system (cases, punishment levels, roles,
// staff points), so the engine pushes them onto a Redis list and this consumer records them. Protection never waits
// for the bot: while it's down the list just grows and is worked through when it's back.

const CTX = "automod-moderation";
export const AUTOMOD_QUEUE = "robtic:automod:moderation";
/** Jail from AutoMod: a day, never permanent — a person can always lift it sooner. */
const JAIL_DAYS = 1;
/** Older records are dropped: punishing someone for a message from days ago would only confuse them. */
const MAX_AGE_SECONDS = 2 * 86_400;

export interface AutomodRecord {
    guildId: string;
    userId: string;
    type: "warn" | "mute" | "timeout" | "jail";
    seconds?: number;
    reason?: string;
    why?: string;
    at?: number;
}

export function parseRecord(raw: string): AutomodRecord | null {
    try {
        const r = JSON.parse(raw) as Partial<AutomodRecord>;
        if (typeof r.guildId !== "string" || typeof r.userId !== "string") return null;
        if (!/^\d{15,22}$/.test(r.guildId) || !/^\d{15,22}$/.test(r.userId)) return null;
        if (r.type !== "warn" && r.type !== "mute" && r.type !== "timeout" && r.type !== "jail") return null;
        return r as AutomodRecord;
    } catch {
        return null;
    }
}

/** The reason recorded on the case: the template's reason, else "AutoMod" with what was caught. */
export const recordReason = (r: AutomodRecord) => (r.reason?.trim() || `AutoMod${r.why ? ` · ${r.why}` : ""}`).slice(0, 500);

/** One record → one case. Returns what happened, for the log. */
export async function processRecord(client: BotClient, guild: Guild | undefined, r: AutomodRecord, now = Date.now() / 1000): Promise<string> {
    if (!guild) return "skipped (not in that server)";
    if (r.at && now - r.at > MAX_AGE_SECONDS) return "skipped (too old)";
    // The engine already applied the Discord timeout itself; nothing to record in the case system for it.
    if (r.type === "timeout") return "skipped (timeout is applied by the engine)";
    const botId = client.user?.id;
    if (!botId) return "skipped (not logged in)";
    const member = guild.members.cache.get(r.userId) ?? await guild.members.fetch(r.userId).catch(() => null);
    const username = member?.user.username ?? (await client.users.fetch(r.userId).catch(() => null))?.username ?? r.userId;
    const reason = recordReason(r);

    if (r.type === "warn") {
        await executeWarn(client, guild.id, r.userId, username, reason, botId, member);
    } else if (r.type === "mute") {
        const ms = Math.min(Math.max(r.seconds ?? 600, 60), MUTE_MAX_HOURS * 3600) * 1000;
        await executeMute(client, guild.id, r.userId, username, reason, botId, member, ms);
    } else {
        await executeBan(client, guild.id, r.userId, username, reason, botId, member, false, JAIL_DAYS, guild);
    }
    return `recorded ${r.type}`;
}

/** Starts working through the AutoMod list once the Gateway leads. No-op without Redis. */
export function startAutomodModeration(client: Client): void {
    if (!isRedisConfigured()) {
        Logger.info("REDIS_URL not set — AutoMod moderation records not consumed", CTX);
        return;
    }
    const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null, lazyConnect: false });
    redis.on("error", err => Logger.warn(`Redis: ${err.message}`, CTX));
    let running = true;

    const loop = async () => {
        while (running) {
            let raw: string | null = null;
            try {
                const res = await redis.brpop(AUTOMOD_QUEUE, 5);
                raw = res?.[1] ?? null;
            } catch (err) {
                if (!running) break;
                Logger.warn(`reading the queue failed: ${(err as Error).message}`, CTX);
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }
            if (!raw) continue;
            const record = parseRecord(raw);
            if (!record) {
                Logger.warn("dropped a malformed AutoMod record", CTX);
                continue;
            }
            try {
                const result = await processRecord(client as BotClient, client.guilds.cache.get(record.guildId), record);
                Logger.info(`guildId=${record.guildId} userId=${record.userId} ${result}`, CTX);
            } catch (err) {
                Logger.warn(`guildId=${record.guildId} userId=${record.userId} ${record.type} failed: ${(err as Error).message}`, CTX);
            }
        }
    };
    void loop();

    onShutdown("automod moderation", async () => {
        running = false;
        redis.disconnect();
    });
    Logger.success("AutoMod moderation consumer started", CTX);
}
