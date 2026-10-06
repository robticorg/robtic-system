import { MUSIC_CONFIG } from "@constants";
import type { IMusicBot } from "@database/models";
import { MusicBotRepository } from "@database/repositories";
import { Logger } from "@logger";
import { inspectBotToken, looksLikeBotToken, type BotAccount } from "./bot-account";
import { getRunningMusicBot, startMusicBot, stopMusicBot } from "./runtime";
import { encryptToken, musicTokenKey } from "./token-crypto";

/**
 * Music bots as a service: what the music app's API does (and the Gateway, when there is no music
 * app). Discord-side setup that needs the *main* bot — the invite link shown to staff, the
 * voice-channel permissions — stays with the Gateway.
 *
 * Problems a user can fix come back as `{ ok: false, problem }` with the sentence to show them.
 */

export type MusicBotStatus = "online" | "not-in-guild" | "offline";

export interface MusicBotView {
    botId: string;
    applicationId: string;
    name: string;
    guildId: string;
    voiceChannelId: string;
    status: MusicBotStatus;
}

export interface CreateMusicBotInput {
    guildId: string;
    token: string;
    name: string;
    voiceChannelId: string;
    createdBy: string;
    /** The main bot's id — its own token is refused. */
    mainBotId: string;
}

export type CreateMusicBotResult = { ok: true; bot: MusicBotView; username: string } | { ok: false; problem: string };

export interface MusicServiceDeps {
    inspect: (token: string) => Promise<BotAccount | null>;
    start: typeof startMusicBot;
}

const defaultDeps: MusicServiceDeps = { inspect: token => inspectBotToken(token), start: startMusicBot };

export function musicBotView(record: IMusicBot): MusicBotView {
    const instance = getRunningMusicBot(record.botId);
    return {
        botId: record.botId,
        applicationId: record.applicationId,
        name: record.name,
        guildId: record.guildId,
        voiceChannelId: record.voiceChannelId,
        status: !instance?.online ? "offline" : instance.inGuild ? "online" : "not-in-guild",
    };
}

/**
 * Registers and starts a music bot. Everything is checked before anything is kept: the token must
 * belong to a real bot, not already be registered, and log in — a bot that can't start is never
 * saved. The token is encrypted before it reaches the database and is never returned.
 */
export async function createMusicBot(input: CreateMusicBotInput, deps: MusicServiceDeps = defaultDeps): Promise<CreateMusicBotResult> {
    const key = musicTokenKey();
    if (!key) return { ok: false, problem: "Music bots aren't set up yet: `MUSIC_TOKEN_KEY` is missing from the music service's environment." };

    if (await MusicBotRepository.countByGuild(input.guildId) >= MUSIC_CONFIG.maxBotsPerGuild) {
        return { ok: false, problem: `This server already has ${MUSIC_CONFIG.maxBotsPerGuild} music bots. Remove one with \`/bot remove\` first.` };
    }

    const token = input.token.trim();
    if (!looksLikeBotToken(token)) return { ok: false, problem: "That doesn't look like a bot token." };

    const account = await deps.inspect(token);
    if (!account) return { ok: false, problem: "Discord didn't accept that token. Copy a fresh one from the Developer Portal (Bot → Reset Token)." };
    if (account.botId === input.mainBotId) return { ok: false, problem: "That's my own token — use a different bot." };

    const record = await MusicBotRepository.create({
        guildId: input.guildId,
        botId: account.botId,
        applicationId: account.applicationId,
        name: input.name.trim(),
        voiceChannelId: input.voiceChannelId,
        encryptedToken: encryptToken(token, key),
        createdBy: input.createdBy,
    });
    if (!record) return { ok: false, problem: `**${account.username}** is already a music bot (here or in another server).` };

    const started = await deps.start(record);
    if (!started.ok) {
        await MusicBotRepository.delete(input.guildId, record.botId);
        return { ok: false, problem: `I couldn't start it, so it wasn't added: ${started.problem}.` };
    }

    Logger.info(`Music bot ${record.name} (${record.botId}) created in ${input.guildId} by ${input.createdBy}`, "music");
    return { ok: true, bot: musicBotView(record), username: account.username };
}

export async function listMusicBots(guildId: string): Promise<MusicBotView[]> {
    return (await MusicBotRepository.listByGuild(guildId)).map(musicBotView);
}

/** Deletes a music bot: it leaves the server, goes offline, and its encrypted token is gone. `null` = no such bot here. */
export async function removeMusicBot(guildId: string, botId: string): Promise<{ name: string; voiceChannelId: string } | null> {
    const record = await MusicBotRepository.delete(guildId, botId);
    if (!record) return null;

    await getRunningMusicBot(record.botId)?.leaveGuild();
    await stopMusicBot(record.botId);
    Logger.info(`Music bot ${record.name} (${record.botId}) removed from ${guildId}`, "music");
    return { name: record.name, voiceChannelId: record.voiceChannelId };
}
