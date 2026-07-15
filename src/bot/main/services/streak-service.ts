import { EmbedBuilder, type Message, type User } from "discord.js";
import { StreakRepository, StreakSettingsRepository } from "@database/repositories";
import type { IStreak, IStreakSettings } from "@database/models";
import { Colors, STREAK_CONFIG } from "@core/config";
import { Logger } from "@core/libs";
import { isClaimable, isStreakExpired, nextClaimAt, streakExpiresAt, isAcceptableMessage } from "@core/utils";
import { applyStreakRole } from "../utils/streakRole";

const CTX = "main:streak";

function isValidStreakMessage(message: Message, settings: IStreakSettings, record: IStreak): boolean {
    if (message.author.bot || message.webhookId) return false;

    const trimmed = message.content.trim();
    if (!isAcceptableMessage(trimmed, settings.minMessageLength)) return false;

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

    const nextClaimMs = record.active ? Math.max(0, nextClaimAt(record.lastIncrement).getTime() - Date.now()) : 0;
    const expiresInMs = record.active ? Math.max(0, streakExpiresAt(record.lastIncrement).getTime() - Date.now()) : null;

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

    const isFreshStart = record.currentStreak === 0;

    if (!isFreshStart && !isClaimable(record.lastIncrement)) return;

    const broken = !isFreshStart && isStreakExpired(record.lastIncrement);
    const newCurrent = isFreshStart || broken ? 1 : record.currentStreak + 1;
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

    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member) {
        await applyStreakRole(member, newCurrent).catch(err =>
            Logger.warn(`Failed to apply streak role for ${message.author.id} in ${guildId}: ${err}`, CTX)
        );
    }

    await sendPublicReply(message, updated);
    await sendStreakDM(message.author, updated);
}

async function sendPublicReply(message: Message, streak: IStreak): Promise<void> {
    if (!message.channel.isSendable()) return;

    const reply = await message
        .reply(`🔥 التتابع ${streak.currentStreak}!\n\nعُد غداً لمواصلة تتابعك.`)
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
        : "لا يوجد تتابع مسجل بعد.";

    return new EmbedBuilder()
        .setTitle(mode === "current" ? "🔥 لوحة متصدري التتابع الحالي" : "🏆 لوحة متصدري أفضل تتابع")
        .setDescription(lines)
        .setColor(Colors.activity)
        .setFooter({ text: guildName })
        .setTimestamp();
}

async function sendStreakDM(user: User, streak: IStreak): Promise<void> {
    const embed = new EmbedBuilder()
        .setTitle("🔥 تم تحديث التتابع اليومي!")
        .addFields(
            { name: "التتابع الحالي", value: `${streak.currentStreak}`, inline: true },
            { name: "أفضل تتابع", value: `${streak.bestStreak}`, inline: true },
        )
        .setDescription("التتابع القادم متاح غداً.")
        .setColor(Colors.activity)
        .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => null);
}
