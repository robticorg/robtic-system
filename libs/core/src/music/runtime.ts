import { MUSIC_CONFIG } from "@constants";
import type { IMusicBot } from "@database/models";
import { MusicBotRepository, MusicSettingsRepository } from "@database/repositories";
import { Logger } from "@logger";
import { L } from "@utils";
import { MusicBotInstance, type MusicBotSettings } from "./engine/music-bot-instance";
import { handleMusicMessage } from "./text-commands";
import { decryptToken, musicTokenKey } from "./token-crypto";

const CTX = "music";

/**
 * The music bots running in this process — the Gateway. Each is its own Discord client, so exactly
 * one process may run them: they start after `waitForGatewayLeadership()` and stop on a handover.
 *
 * The dashboard edits the saved bots directly (add, rename, move, mode, restart, delete); the sync below applies
 * those changes to the running bots every few seconds, and writes back what each is doing for the dashboard.
 */
const running = new Map<string, { instance: MusicBotInstance; startedAt: number }>();
/** Bots that failed to start, and when: retried every few minutes, not every sync. */
const failed = new Map<string, number>();
const RETRY_FAILED_MS = 5 * 60_000;

/** The main bot's part when a fixed bot gets a (new) channel: its permissions there. Set by apps/bot. */
let onChannelAssigned: ((record: IMusicBot) => Promise<void>) | null = null;
export function setMusicChannelHook(hook: (record: IMusicBot) => Promise<void>): void {
    onChannelAssigned = hook;
}

export function getRunningMusicBot(botId: string): MusicBotInstance | undefined {
    return running.get(botId)?.instance;
}

export function runningMusicBotCount(): number {
    return running.size;
}

/** A server's running music bots. */
export function musicBotsInGuild(guildId: string): MusicBotInstance[] {
    return [...running.values()].map(r => r.instance).filter(i => i.settings.guildId === guildId);
}

const settingsOf = (record: IMusicBot): MusicBotSettings => ({
    botId: record.botId,
    name: record.name,
    guildId: record.guildId,
    mode: record.mode === "roaming" ? "roaming" : "fixed",
    voiceChannelId: record.voiceChannelId ?? null,
});

/** Logs a music bot in and keeps it in the registry. Replaces a previous instance of the same bot. */
export async function startMusicBot(record: IMusicBot): Promise<{ ok: true } | { ok: false; problem: string }> {
    const key = musicTokenKey();
    if (!key) return { ok: false, problem: "MUSIC_TOKEN_KEY is not set (or is not 32 bytes) — music bots can't start" };

    const token = decryptToken(record.encryptedToken, key);
    if (!token) return { ok: false, problem: "its stored token can't be decrypted — was MUSIC_TOKEN_KEY changed?" };

    await stopMusicBot(record.botId);

    const instance = new MusicBotInstance(settingsOf(record), token, {
        onMessage: (bot, message) => handleMusicMessage(bot, message, () => musicBotsInGuild(bot.settings.guildId)),
    });
    running.set(record.botId, { instance, startedAt: Date.now() });

    try {
        await instance.start();
        failed.delete(record.botId);
        return { ok: true };
    } catch (err) {
        running.delete(record.botId);
        failed.set(record.botId, Date.now());
        await instance.destroy().catch(() => null);
        return { ok: false, problem: L(`Discord refused to log it in (${(err as Error).message}) — the token may have been reset`, `رفض ديسكورد تسجيل الدخول (${(err as Error).message})، قد يكون التوكن قد تغيّر`) };
    }
}

export async function stopMusicBot(botId: string): Promise<void> {
    const entry = running.get(botId);
    if (!entry) return;
    running.delete(botId);
    await entry.instance.destroy().catch(err => Logger.warn(`Stopping music bot ${botId}: ${err}`, CTX));
}

/** Logs every music bot out — on shutdown, or before a Gateway hands over to another one. */
export async function stopAllMusicBots(): Promise<void> {
    stopMusicSync();
    await Promise.all([...running.keys()].map(stopMusicBot));
}

/**
 * Brings back every saved music bot that isn't online — never touches one that is, so whatever it
 * is playing keeps playing. The Gateway runs this each time it starts.
 */
export async function ensureAllMusicBots(): Promise<{ restarted: number; alreadyOnline: number; failed: number }> {
    const records = await MusicBotRepository.listAll();
    let restarted = 0, alreadyOnline = 0, failedCount = 0;
    for (const record of records) {
        if (running.get(record.botId)?.instance.online) { alreadyOnline++; continue; }
        const result = await startMusicBot(record);
        if (result.ok) restarted++;
        else {
            failedCount++;
            Logger.warn(`Music bot ${record.name} (${record.botId}) didn't restart: ${result.problem}`, CTX);
        }
    }
    if (restarted || failedCount) Logger.info(`Music bots: ${restarted} restarted, ${alreadyOnline} already online, ${failedCount} failed`, CTX);
    return { restarted, alreadyOnline, failed: failedCount };
}

const sameSettings = (a: MusicBotSettings, b: MusicBotSettings) =>
    a.name === b.name && a.mode === b.mode && a.voiceChannelId === b.voiceChannelId && a.guildId === b.guildId;

/** One pass: saved bots vs running ones. */
export async function syncMusicBots(): Promise<void> {
    const records = await MusicBotRepository.listAll();
    const saved = new Set(records.map(r => r.botId));
    // The dashboard may have changed "stay" or the words: read them fresh this pass.
    MusicSettingsRepository.forget();

    for (const [botId, entry] of [...running]) {
        if (saved.has(botId)) continue;
        await entry.instance.leaveGuild();
        await stopMusicBot(botId);
        Logger.info(`Music bot ${entry.instance.settings.name} (${botId}) was deleted on the dashboard — logged out`, CTX);
    }

    for (const record of records) {
        const entry = running.get(record.botId);
        const restartAsked = !!record.restartAt && (!entry || record.restartAt.getTime() > entry.startedAt);
        if (!entry || restartAsked) {
            if (!entry && !restartAsked && Date.now() - (failed.get(record.botId) ?? 0) < RETRY_FAILED_MS) continue;
            const result = await startMusicBot(record);
            if (restartAsked) await MusicBotRepository.clearRestart(record.botId);
            if (!result.ok) Logger.warn(`Music bot ${record.name} (${record.botId}) didn't start: ${result.problem}`, CTX);
            else {
                Logger.info(`Music bot ${record.name} (${record.botId}) ${restartAsked ? "restarted from the dashboard" : "started"}`, CTX);
                if (record.mode !== "roaming" && record.voiceChannelId) await onChannelAssigned?.(record).catch(() => null);
            }
            continue;
        }
        const next = settingsOf(record);
        if (!sameSettings(entry.instance.settings, next)) {
            const moved = next.voiceChannelId !== entry.instance.settings.voiceChannelId || next.mode !== entry.instance.settings.mode;
            await entry.instance.update(next).catch(e => Logger.warn(`Updating ${record.name}: ${(e as Error).message}`, CTX));
            if (moved && next.mode === "fixed" && next.voiceChannelId) await onChannelAssigned?.(record).catch(() => null);
        } else {
            await entry.instance.reconcilePresence().catch(() => null);
        }
    }

    for (const { instance } of running.values()) {
        await MusicBotRepository.report(instance.settings.botId, {
            inGuild: instance.online && instance.inGuild,
            connectedChannelId: instance.connectedChannelId,
            nowPlaying: instance.nowPlayingTitle,
            readsMessages: instance.readsMessages,
        }).catch(() => null);
    }
}

let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncing = false;

/** Starts the sync (the Gateway, after the bots are up). */
export function startMusicSync(): void {
    if (syncTimer) return;
    const tick = async () => {
        if (syncing) return;
        syncing = true;
        try { await syncMusicBots(); } catch (e) { Logger.warn(`music sync: ${(e as Error).message}`, CTX); } finally { syncing = false; }
    };
    void tick();
    syncTimer = setInterval(tick, MUSIC_CONFIG.syncSeconds * 1000);
}

export function stopMusicSync(): void {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
}
