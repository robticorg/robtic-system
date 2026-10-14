import { decryptToken, musicTokenKey } from "@core/music";
import { Logger } from "@logger";
import { CompetitionBot, type ICompetitionBot } from "./models";
import { CompetitionBotInstance } from "./instance";

const CTX = "competition";
/** A bot not connected for this long is logged in again from scratch. */
const OFFLINE_LIMIT_MS = 2 * 60_000;
const WATCHDOG_MS = 30_000;

/**
 * TEMP — the competition bots running in this process (one per server). Like music bots they live
 * inside the main bot, so they are online whenever it is. On top of discord.js's own reconnects, a
 * watchdog logs a bot in again if it stays offline, or if it never managed to log in.
 */
const running = new Map<string, CompetitionBotInstance>();
const offlineSince = new Map<string, number>();
let watchdog: ReturnType<typeof setInterval> | null = null;

export function getCompetitionBot(guildId: string): CompetitionBotInstance | undefined {
    return running.get(guildId);
}

export async function startCompetitionBot(record: ICompetitionBot): Promise<{ ok: true } | { ok: false; problem: string }> {
    const key = musicTokenKey();
    if (!key) return { ok: false, problem: "MUSIC_TOKEN_KEY is not set — it encrypts the token" };
    const token = decryptToken(record.encryptedToken, key);
    if (!token) return { ok: false, problem: "its stored token can't be decrypted — was MUSIC_TOKEN_KEY changed?" };

    await stopCompetitionBot(record.guildId);
    const instance = new CompetitionBotInstance(record.guildId, token);
    running.set(record.guildId, instance);
    offlineSince.delete(record.guildId);
    startWatchdog();

    try {
        await instance.start();
        return { ok: true };
    } catch (err) {
        // Stays in the registry: the watchdog keeps trying, so a Discord outage doesn't take it down for good.
        return { ok: false, problem: `Discord refused to log it in (${(err as Error).message})` };
    }
}

export async function stopCompetitionBot(guildId: string): Promise<void> {
    const instance = running.get(guildId);
    if (!instance) return;
    running.delete(guildId);
    offlineSince.delete(guildId);
    await instance.destroy().catch(err => Logger.warn(`Stopping competition bot ${guildId}: ${err}`, CTX));
}

/** On shutdown or a Gateway handover. */
export async function stopAllCompetitionBots(): Promise<void> {
    if (watchdog) clearInterval(watchdog);
    watchdog = null;
    await Promise.all([...running.keys()].map(stopCompetitionBot));
}

/** Every saved competition bot that isn't online comes back. Run each time the main bot is ready. */
export async function ensureAllCompetitionBots(): Promise<void> {
    for (const record of await CompetitionBot.find({})) {
        if (running.get(record.guildId)?.online) continue;
        const result = await startCompetitionBot(record);
        if (!result.ok) Logger.warn(`Competition bot for ${record.guildId} didn't start: ${result.problem}`, CTX);
    }
}

function startWatchdog(): void {
    if (watchdog) return;
    watchdog = setInterval(() => {
        void (async () => {
            for (const [guildId, instance] of [...running]) {
                if (instance.online) { offlineSince.delete(guildId); continue; }
                const since = offlineSince.get(guildId) ?? Date.now();
                offlineSince.set(guildId, since);
                if (Date.now() - since < OFFLINE_LIMIT_MS) continue;

                const record = await CompetitionBot.findOne({ guildId });
                if (!record) { await stopCompetitionBot(guildId); continue; }
                Logger.warn(`Competition bot for ${guildId} offline for ${Math.round((Date.now() - since) / 1000)}s — logging in again`, CTX);
                const result = await startCompetitionBot(record);
                if (!result.ok) {
                    offlineSince.set(guildId, Date.now());
                    Logger.warn(`Competition bot for ${guildId}: ${result.problem}`, CTX);
                }
            }
        })().catch(err => Logger.warn(`Competition watchdog: ${err}`, CTX));
    }, WATCHDOG_MS);
}
