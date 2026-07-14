import { EmbedBuilder, type Message, type User } from "discord.js";
import { StreakRepository, StreakSettingsRepository } from "@database/repositories";
import type { IStreak, IStreakSettings } from "@database/models";
import { Colors, STREAK_CONFIG } from "@core/config";
import { Logger } from "@core/libs";

const CTX = "main:streak";

const EMOJI_REGEX = /<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️‍]/gu;

function isEmojiOnly(content: string): boolean {
    return content.replace(EMOJI_REGEX, "").trim().length === 0;
}

function isValidStreakMessage(message: Message, settings: IStreakSettings, record: IStreak): boolean {
    if (message.author.bot || message.webhookId) return false;

    const trimmed = message.content.trim();
    if (trimmed.length < settings.minMessageLength) return false;
    if (isEmojiOnly(trimmed)) return false;

    const isDuplicate = trimmed.toLowerCase() === record.lastMessageContent.trim().toLowerCase();
    const withinDuplicateWindow = Date.now() - record.lastMessageAt.getTime() < STREAK_CONFIG.duplicateWindowMs;
    if (isDuplicate && withinDuplicateWindow) return false;

    return true;
}

export interface StreakSummary {
    record: IStreak;
    rank: number;
    bestRank: number;
    /** Milliseconds remaining before the next streak claim is available. 0 if claimable now. */
    nextClaimMs: number;
    /** Milliseconds remaining until the streak expires, or null if there's no active streak. */
    expiresInMs: number | null;
}

export async function getStreakSummary(discordId: string, guildId: string, username: string): Promise<StreakSummary> {
    const record = await StreakRepository.findOrCreate(discordId, guildId, username);
    const rank = await StreakRepository.getRank(discordId, guildId);
    const bestRank = await StreakRepository.getBestRank(discordId, guildId);

    const elapsed = Date.now() - record.lastIncrement.getTime();
    const nextClaimMs = record.active ? Math.max(0, STREAK_CONFIG.claimWindowMs - elapsed) : 0;
    const expiresInMs = record.active ? Math.max(0, STREAK_CONFIG.expireWindowMs - elapsed) : null;

    return { record, rank, bestRank, nextClaimMs, expiresInMs };
}

export async function processStreakMessage(message: Message): Promise<void> {
    if (!message.guild) return;
    if (message.author.bot || message.webhookId) return;

    const guildId = message.guild.id;
    const settings = await StreakSettingsRepository.get(guildId);
    if (!settings || settings.channels.length === 0) return;
    if (!settings.channels.includes(message.channel.id)) return;

    const record = await StreakRepository.findOrCreate(message.author.id, guildId, message.author.username);

    if (!isValidStreakMessage(message, settings, record)) return;

    const elapsed = Date.now() - record.lastIncrement.getTime();
    const isFreshStart = record.currentStreak === 0;

    if (!isFreshStart && elapsed < STREAK_CONFIG.claimWindowMs) return;

    const withinGrace = elapsed <= STREAK_CONFIG.expireWindowMs;
    const newCurrent = isFreshStart || !withinGrace ? 1 : record.currentStreak + 1;
    const newBest = Math.max(record.bestStreak, newCurrent);

    const updated = await StreakRepository.applyIncrement(
        message.author.id,
        guildId,
        newCurrent,
        newBest,
        message.content.trim(),
    );
    if (!updated) return;

    Logger.debug(`${message.author.username} (${message.author.id}) streak → ${newCurrent} (best ${newBest})`, CTX);

    await sendPublicReply(message, updated);
    await sendStreakDM(message.author, updated);
}

async function sendPublicReply(message: Message, streak: IStreak): Promise<void> {
    if (!message.channel.isSendable()) return;

    const reply = await message
        .reply(`🔥 Streak ${streak.currentStreak}!\n\nCome back tomorrow to continue your streak.`)
        .catch(() => null);
    if (!reply) return;

    setTimeout(() => {
        reply.delete().catch(() => null);
    }, STREAK_CONFIG.autoDeleteMs);
}

export type LeaderboardMode = "current" | "best";

export async function getLeaderboard(guildId: string, mode: LeaderboardMode, limit = 5): Promise<IStreak[]> {
    return mode === "current"
        ? StreakRepository.getCurrentLeaderboard(guildId, limit)
        : StreakRepository.getBestLeaderboard(guildId, limit);
}

export function buildLeaderboardEmbed(guildName: string, mode: LeaderboardMode, records: IStreak[]): EmbedBuilder {
    const lines = records.length
        ? records.map((r, i) => `**${i + 1}.** <@${r.discordId}> — ${mode === "current" ? r.currentStreak : r.bestStreak} 🔥`).join("\n")
        : "No streaks recorded yet.";

    return new EmbedBuilder()
        .setTitle(mode === "current" ? "🔥 Current Streak Leaderboard" : "🏆 Best Streak Leaderboard")
        .setDescription(lines)
        .setColor(Colors.activity)
        .setFooter({ text: guildName })
        .setTimestamp();
}

async function sendStreakDM(user: User, streak: IStreak): Promise<void> {
    const embed = new EmbedBuilder()
        .setTitle("🔥 Daily streak updated!")
        .addFields(
            { name: "Current Streak", value: `${streak.currentStreak}`, inline: true },
            { name: "Best Streak", value: `${streak.bestStreak}`, inline: true },
        )
        .setDescription("Next streak available tomorrow.")
        .setColor(Colors.activity)
        .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => null);
}
