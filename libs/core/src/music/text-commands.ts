import type { Message } from "discord.js";
import { MUSIC_WORD_KEYS, type MusicWordKey, type MusicWords } from "@database/models";
import { MusicSettingsRepository } from "@database/repositories";
import { Logger } from "@logger";
import { L } from "@utils";
import { MUSIC_CONFIG } from "@constants";
import type { MusicBotInstance } from "./engine/music-bot-instance";
import { pickBot, pickProblem } from "./router";

/**
 * Text commands, typed in the chat of the voice channel you're in: `ش song`, `stop`, `skip`, `pause`, `resume`,
 * `volume 70`. The words are each server's own (RobTic Music dashboard → General).
 *
 * Every music bot in the server can see the message, so the first one to get it claims it and the router picks the
 * bot that actually answers; the others ignore it.
 */

const claimed = new Map<string, number>();
const CLAIM_MS = 60_000;

/** True for the first caller per message id. */
function claim(messageId: string): boolean {
    const now = Date.now();
    if (claimed.size > 500) for (const [id, at] of claimed) if (now - at > CLAIM_MS) claimed.delete(id);
    if (claimed.has(messageId)) return false;
    claimed.set(messageId, now);
    return true;
}

/** Which command a message is, and the rest of it. Longer words first, so `play` never shadows `playlist`-like words. */
export function parseMusicCommand(content: string, words: MusicWords): { command: MusicWordKey; rest: string } | null {
    const text = content.trim();
    const lower = text.toLowerCase();
    const all = MUSIC_WORD_KEYS.flatMap(k => words[k].map(w => ({ k, w }))).sort((a, b) => b.w.length - a.w.length);
    for (const { k, w } of all) {
        if (lower === w || lower.startsWith(`${w} `)) return { command: k, rest: text.slice(w.length).trim() };
    }
    return null;
}

async function reply(bot: MusicBotInstance, message: Message, text: string): Promise<void> {
    // The answering bot replies when it can see the chat; otherwise the bot that got the message does.
    const channel = await bot.client.channels.fetch(message.channelId).catch(() => null);
    if (channel?.isSendable()) {
        const sent = await channel.send({ content: text, reply: { messageReference: message.id, failIfNotExists: false }, allowedMentions: { parse: [] } }).catch(() => null);
        if (sent) return;
    }
    await message.reply({ content: text, allowedMentions: { parse: [] } }).catch(() => null);
}

export async function handleMusicMessage(receiver: MusicBotInstance, message: Message, bots: () => MusicBotInstance[]): Promise<void> {
    if (message.author.bot || message.guildId !== receiver.settings.guildId) return;
    // Only in a voice channel's own chat.
    if (!message.channel.isVoiceBased()) return;

    const settings = await MusicSettingsRepository.get(receiver.settings.guildId);
    if (!settings.commands) return;
    const parsed = parseMusicCommand(message.content, settings.words);
    if (!parsed || !claim(message.id)) return;

    const all = bots();
    const voiceChannelId = message.member?.voice.channelId ?? null;
    // In a voice channel, commands go in that channel's own chat (as before); another channel's chat is ignored.
    if (voiceChannelId && voiceChannelId !== message.channelId) return;
    const starting = parsed.command === "play";
    const pick = pickBot(all, voiceChannelId, { starting });
    if (!pick.ok) return void await reply(receiver, message, pickProblem(pick.reason, all));
    const bot = pick.bot;

    try {
        switch (parsed.command) {
            case "play": {
                if (!parsed.rest) return void await reply(bot, message, L("Write a song name or a link after the command, like `play never gonna give you up`.", "يرجى كتابة اسم الأغنية أو الرابط بعد الأمر، مثال: `ش عزرائيل`."));
                const { track, queued } = await bot.play(parsed.rest, { requestedBy: message.author.username, voiceChannelId: voiceChannelId!, textChannelId: voiceChannelId! });
                if (queued) await reply(bot, message, L(`➕ Added to the queue: **${track.title}**`, `➕ تمت الإضافة إلى القائمة: **${track.title}**`));
                return;
            }
            case "stop":
                if (await bot.stop()) await reply(bot, message, L("⏹️ Stopped and cleared the queue.", "⏹️ تم إيقاف التشغيل ومسح القائمة."));
                return;
            case "skip":
                await reply(bot, message, bot.skip() ? L("⏭️ Skipped.", "⏭️ تم التخطي.") : L("Nothing to skip to.", "لا توجد أغنية تالية."));
                return;
            case "pause":
                if (bot.pause()) await reply(bot, message, L("⏸️ Paused.", "⏸️ تم الإيقاف المؤقت."));
                return;
            case "resume":
                if (bot.resume()) await reply(bot, message, L("▶️ Resumed.", "▶️ تمت المتابعة."));
                return;
            case "volume": {
                const raw = parsed.rest;
                if (!/^\d+(?:\.\d+)?$/.test(raw)) {
                    return void await reply(bot, message, L(`Give a volume from 0 to ${MUSIC_CONFIG.maxVolume}, like \`volume 70\`.`, `يرجى كتابة مستوى الصوت من 0 إلى ${MUSIC_CONFIG.maxVolume}، مثال: \`صوت 70\`.`));
                }
                const v = bot.setVolume(Number(raw));
                await reply(bot, message, L(`🔊 Volume: **${v}%**`, `🔊 مستوى الصوت: **${v}%**`));
                return;
            }
        }
    } catch (e) {
        Logger.warn(`text command ${parsed.command}: ${(e as Error).message}`, "music");
        await reply(bot, message, `❌ ${(e as Error).message}`);
    }
}
