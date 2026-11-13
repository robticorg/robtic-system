import { EmbedBuilder, type Guild, type User } from "discord.js";
import { COLORS } from "@constants";
import { VoiceRepository, PeriodicStatRepository } from "@database/repositories";
import { formatVoiceDuration } from "./format-duration";
import { getSession } from "../functions/session-store";

import { L } from "@utils";
/**
 * One member's voice standing.
 *
 * Period figures come from PeriodicStat — the same store every other period leaderboard reads —
 * and the open session is folded in from memory so the numbers include the call they are in right
 * now rather than lagging until they disconnect.
 */
export async function buildVoiceEmbed(guild: Guild, user: User): Promise<EmbedBuilder> {
    const [stat, daily, weekly, monthly, rank] = await Promise.all([
        VoiceRepository.getStat(guild.id, user.id),
        PeriodicStatRepository.getValue(guild.id, "daily", "voiceTime", user.id),
        PeriodicStatRepository.getValue(guild.id, "weekly", "voiceTime", user.id),
        PeriodicStatRepository.getValue(guild.id, "monthly", "voiceTime", user.id),
        VoiceRepository.getRankByActiveTime(guild.id, user.id),
    ]);

    const live = getSession(guild.id, user.id);
    const totalConnected = (stat?.totalConnectedSeconds ?? 0) + (live?.connectedSeconds ?? 0);
    const totalActive = (stat?.totalActiveSeconds ?? 0) + (live?.activeSeconds ?? 0);
    const totalXp = (stat?.totalXpEarned ?? 0) + (live?.xpEarned ?? 0);

    return new EmbedBuilder()
        .setTitle(L(`🎙️ Voice activity — ${user.username}`, `🎙️ النشاط الصوتي — ${user.username}`))
        .setColor(COLORS.activity)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: "Today", value: formatVoiceDuration(daily), inline: true },
            { name: L("This week", "هذا الأسبوع"), value: formatVoiceDuration(weekly), inline: true },
            { name: L("This month", "هذا الشهر"), value: formatVoiceDuration(monthly), inline: true },
            { name: L("Total connected", "مجموع الاتصال"), value: formatVoiceDuration(totalConnected), inline: true },
            { name: L("Total active", "مجموع النشاط"), value: formatVoiceDuration(totalActive), inline: true },
            { name: L("Voice XP", "خبرة الصوت"), value: `${totalXp}`, inline: true },
            { name: "Sessions", value: `${stat?.sessionCount ?? 0}`, inline: true },
            { name: L("Average session", "متوسط الجلسة"), value: formatVoiceDuration(VoiceRepository.averageSessionSeconds(stat)), inline: true },
            { name: L("Longest session", "أطول جلسة"), value: formatVoiceDuration(stat?.longestSessionSeconds ?? 0), inline: true },
            { name: L("Rank by active time", "الترتيب بوقت النشاط"), value: rank > 0 ? `#${rank}` : L("Unranked", "غير مصنف"), inline: true },
            ...(live ? [{ name: L("In voice now", "في الصوت الحين"), value: formatVoiceDuration(live.connectedSeconds), inline: true }] : []),
        )
        .setFooter({ text: L("Active time is time spent taking part: AFK and the AFK channel don't count.", "وقت النشاط هو وقت المشاركة: AFK وروم AFK ما ينحسبون.") })
        .setTimestamp();
}
