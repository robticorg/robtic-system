import type { Client, Guild } from "discord.js";
import { MUSIC_CONFIG } from "@constants";
import { decryptToken, musicTokenKey } from "@core/music";
import { MusicBotRepository } from "@database/repositories";
import type { IMusicBot } from "@database/models";
import { Logger } from "@logger";
import { MusicBotInstance } from "./music-bot-instance";

const CTX = "music";

/** Every running music bot, by bot id. */
const running = new Map<string, MusicBotInstance>();

export function getMusicBot(botId: string): MusicBotInstance | undefined {
    return running.get(botId);
}

/**
 * Gives a music bot what it needs on its own voice channel — and nothing anywhere else, since it
 * is invited with no permissions. Done by the main bot (which needs Manage Roles there), and only
 * once the music bot is a member: Discord can't add a member overwrite for someone not in the
 * server. Returns a problem to show staff, or `null` when it worked.
 */
export async function grantVoicePermissions(guild: Guild, record: Pick<IMusicBot, "botId" | "voiceChannelId">): Promise<string | null> {
    const channel = guild.channels.cache.get(record.voiceChannelId) ?? await guild.channels.fetch(record.voiceChannelId).catch(() => null);
    if (!channel?.isVoiceBased()) return "its voice channel no longer exists";
    if (!guild.members.cache.has(record.botId) && !(await guild.members.fetch(record.botId).catch(() => null))) return "it isn't in the server yet";

    const allow = Object.fromEntries(MUSIC_CONFIG.channelPermissions.map(name => [name, true]));
    try {
        await channel.permissionOverwrites.edit(record.botId, allow, { reason: "Music bot: its assigned voice channel" });
        return null;
    } catch {
        return `I couldn't set its permissions on <#${channel.id}> — I need **Manage Roles** (Manage Permissions) there`;
    }
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

/** On startup: logs in every saved music bot and makes sure each has its voice-channel permissions. */
export async function startAllMusicBots(mainClient: Client): Promise<void> {
    const records = await MusicBotRepository.listAll();
    if (!records.length) return;

    for (const record of records) {
        const result = await startMusicBot(record);
        if (!result.ok) {
            Logger.warn(`Music bot ${record.name} (${record.botId}) didn't start: ${result.problem}`, CTX);
            continue;
        }
        const guild = mainClient.guilds.cache.get(record.guildId);
        if (guild) await grantVoicePermissions(guild, record);
    }
    Logger.info(`Started ${running.size}/${records.length} music bots`, CTX);
}
