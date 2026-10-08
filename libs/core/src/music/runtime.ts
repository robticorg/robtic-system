import type { IMusicBot } from "@database/models";
import { MusicBotRepository } from "@database/repositories";
import { Logger } from "@logger";
import { MusicBotInstance } from "./engine/music-bot-instance";
import { decryptToken, musicTokenKey } from "./token-crypto";

const CTX = "music";

/**
 * The music bots running in **this process** — the music app (`apps/music`), or the Gateway when
 * no music app is configured. Each is its own Discord client, so exactly one process may run them.
 */
const running = new Map<string, MusicBotInstance>();

export function getRunningMusicBot(botId: string): MusicBotInstance | undefined {
    return running.get(botId);
}

export function runningMusicBotCount(): number {
    return running.size;
}

/** Logs a music bot in and keeps it in the registry. Replaces a previous instance of the same bot. */
export async function startMusicBot(record: IMusicBot): Promise<{ ok: true } | { ok: false; problem: string }> {
    const key = musicTokenKey();
    if (!key) return { ok: false, problem: "MUSIC_TOKEN_KEY is not set (or is not 32 bytes) — music bots can't start" };

    const token = decryptToken(record.encryptedToken, key);
    if (!token) return { ok: false, problem: "its stored token can't be decrypted — was MUSIC_TOKEN_KEY changed?" };

    await stopMusicBot(record.botId);

    const instance = new MusicBotInstance(
        { botId: record.botId, name: record.name, guildId: record.guildId, voiceChannelId: record.voiceChannelId },
        token,
    );
    running.set(record.botId, instance);

    try {
        await instance.start();
        return { ok: true };
    } catch (err) {
        running.delete(record.botId);
        await instance.destroy().catch(() => null);
        return { ok: false, problem: `Discord refused to log it in (${(err as Error).message}) — the token may have been reset` };
    }
}

export async function stopMusicBot(botId: string): Promise<void> {
    const instance = running.get(botId);
    if (!instance) return;
    running.delete(botId);
    await instance.destroy().catch(err => Logger.warn(`Stopping music bot ${botId}: ${err}`, CTX));
}

/** Logs every music bot out — on shutdown, or before a Gateway hands over to another one. */
export async function stopAllMusicBots(): Promise<void> {
    await Promise.all([...running.keys()].map(stopMusicBot));
}

/**
 * Brings back every saved music bot that isn't online — never touches one that is, so whatever it
 * is playing keeps playing. The Gateway asks for this each time it starts.
 */
export async function ensureAllMusicBots(): Promise<{ restarted: number; alreadyOnline: number; failed: number }> {
    const records = await MusicBotRepository.listAll();
    let restarted = 0, alreadyOnline = 0, failed = 0;
    for (const record of records) {
        if (running.get(record.botId)?.online) { alreadyOnline++; continue; }
        const result = await startMusicBot(record);
        if (result.ok) restarted++;
        else {
            failed++;
            Logger.warn(`Music bot ${record.name} (${record.botId}) didn't restart: ${result.problem}`, CTX);
        }
    }
    if (restarted || failed) Logger.info(`Music bots: ${restarted} restarted, ${alreadyOnline} already online, ${failed} failed`, CTX);
    return { restarted, alreadyOnline, failed };
}

/** On startup: logs in every saved music bot. Returns the ones that started. */
export async function startAllMusicBots(): Promise<IMusicBot[]> {
    const records = await MusicBotRepository.listAll();
    const started: IMusicBot[] = [];
    for (const record of records) {
        const result = await startMusicBot(record);
        if (result.ok) started.push(record);
        else Logger.warn(`Music bot ${record.name} (${record.botId}) didn't start: ${result.problem}`, CTX);
    }
    if (records.length) Logger.info(`Started ${started.length}/${records.length} music bots`, CTX);
    return started;
}
