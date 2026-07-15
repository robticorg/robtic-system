import { EmbedBuilder, type Guild } from "discord.js";
import { Colors, type ComboLeaderboardPeriod, type ComboLeaderboardType } from "@core/config";
import { formatDuration } from "@core/utils";
import { ComboSettingsRepository, ComboRepository, ComboUserStatsRepository } from "@database/repositories";
import { getUserHighestCombo, getUserComboRank } from "../services/combo-service";
import { heatStatusLabel } from "../services/combo-heat";
import { getFavoritePartner } from "../services/combo-favorite-partner";
import { getHistoryForUser } from "../services/combo-history-service";
import { getLeaderboard } from "../services/combo-leaderboard-service";
import { getServerRecords } from "../services/combo-record-service";

export interface ComboTarget {
    id: string;
    username: string;
    avatarUrl: string;
}

const LEADERBOARD_PERIOD_LABELS: Record<ComboLeaderboardPeriod, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    alltime: "All Time",
};

const LEADERBOARD_TYPE_LABELS: Record<ComboLeaderboardType, string> = {
    combo: "Highest Combo",
    streak: "Conversation Streak",
    partner: "Favorite Partner",
};

function baseEmbed(title: string): EmbedBuilder {
    return new EmbedBuilder().setTitle(title).setColor(Colors.activity).setTimestamp();
}

async function favoritePartnerLine(guildId: string, userId: string): Promise<string> {
    const stats = await ComboUserStatsRepository.get(guildId, userId);
    const favorite = getFavoritePartner(stats);
    if (!favorite) return "None yet";
    return `<@${favorite.partnerId}> — ${favorite.conversations} conversation(s)`;
}

export async function buildStatusEmbed(guild: Guild, target: ComboTarget): Promise<EmbedBuilder> {
    const highest = await getUserHighestCombo(guild.id, target.id);
    const rank = await getUserComboRank(guild.id, target.id);
    const activeCombos = await ComboRepository.findActiveForUser(guild.id, target.id);
    const favoriteLine = await favoritePartnerLine(guild.id, target.id);

    const embed = baseEmbed(`🔥 Combo Status — ${target.username}`).setThumbnail(target.avatarUrl);

    if (highest) {
        embed.addFields(
            { name: "Current Highest Combo", value: `**${highest.pair.currentScore}** with <@${highest.partnerId}>`, inline: true },
            { name: "Level", value: highest.pair.level, inline: true },
            { name: "Heat", value: `🔥 ${Math.round(highest.pair.heat)}% — ${heatStatusLabel(highest.pair.heat)}`, inline: true },
            { name: "Conversation Streak", value: `${highest.pair.streakCurrent} day(s) (best ${highest.pair.streakBest})`, inline: true },
        );
    } else {
        embed.addFields({ name: "Current Highest Combo", value: "No active combo right now." });
    }

    embed.addFields(
        { name: "Favorite Partner", value: favoriteLine, inline: true },
        { name: "Ranking", value: rank > 0 ? `#${rank}` : "Unranked", inline: true },
        { name: "Active Combos", value: `${activeCombos.length}`, inline: true },
    );

    return embed;
}

export async function buildStatisticsEmbed(guild: Guild, target: ComboTarget): Promise<EmbedBuilder> {
    const highest = await getUserHighestCombo(guild.id, target.id);
    const stats = await ComboUserStatsRepository.get(guild.id, target.id);
    const favoriteLine = await favoritePartnerLine(guild.id, target.id);

    const avgCombo = stats && stats.totalConversations > 0 ? Math.round(stats.totalScoreSum / stats.totalConversations) : 0;
    const avgDuration = stats && stats.totalConversations > 0 ? Math.round(stats.totalDurationMs / stats.totalConversations) : 0;

    return baseEmbed(`📊 Combo Statistics — ${target.username}`)
        .setThumbnail(target.avatarUrl)
        .addFields(
            { name: "Current Combo", value: highest ? `${highest.pair.currentScore} (${highest.pair.level})` : "None", inline: true },
            { name: "Best Combo", value: stats ? `${stats.bestComboScore}${stats.bestComboPartnerId ? ` with <@${stats.bestComboPartnerId}>` : ""}` : "None", inline: true },
            { name: "Favorite Partner", value: favoriteLine, inline: true },
            { name: "Current Conversation Streak", value: highest ? `${highest.pair.streakCurrent} day(s)` : "0 days", inline: true },
            { name: "Best Conversation Streak", value: `${stats?.bestStreakEver ?? 0} day(s)`, inline: true },
            { name: "Total Conversations", value: `${stats?.totalConversations ?? 0}`, inline: true },
            { name: "Different Partners", value: `${stats?.distinctPartners ?? 0}`, inline: true },
            { name: "Messages", value: `${stats?.totalMessages ?? 0}`, inline: true },
            { name: "Average Combo", value: `${avgCombo}`, inline: true },
            { name: "Average Duration", value: formatDuration(avgDuration), inline: true },
            { name: "Longest Conversation", value: formatDuration(stats?.longestConversationMs ?? 0), inline: true },
        );
}

export async function buildHistoryEmbed(guild: Guild, target: ComboTarget): Promise<EmbedBuilder> {
    const history = await getHistoryForUser(guild.id, target.id);

    const description = history.length
        ? history.map(h => {
            const partnerId = h.userAId === target.id ? h.userBId : h.userAId;
            return `<@${partnerId}> — **${h.score}** (${h.level}) — ${formatDuration(h.durationMs)} — <t:${Math.floor(h.endedAt.getTime() / 1000)}:R>`;
        }).join("\n")
        : "No past combos yet.";

    return baseEmbed(`📜 Combo History — ${target.username}`).setDescription(description);
}

export async function buildLeaderboardEmbed(
    guild: Guild,
    period: ComboLeaderboardPeriod,
    type: ComboLeaderboardType,
): Promise<EmbedBuilder> {
    const entries = await getLeaderboard(guild.id, period, type);

    const description = entries.length
        ? entries.map((e, i) => `**${i + 1}.** <@${e.discordId}> — ${Math.round(e.value)}`).join("\n")
        : "No data for this period yet.";

    return baseEmbed(`🏆 ${LEADERBOARD_TYPE_LABELS[type]} — ${LEADERBOARD_PERIOD_LABELS[period]}`)
        .setDescription(description)
        .setFooter({ text: guild.name });
}

export async function buildServerRecordsEmbed(guild: Guild): Promise<EmbedBuilder> {
    const records = await getServerRecords(guild.id);

    const line = (entry: { value: number; userAId: string; userBId: string } | null, formatter: (v: number) => string) =>
        entry ? `${formatter(entry.value)} — <@${entry.userAId}> & <@${entry.userBId}>` : "Not set yet";

    return baseEmbed(`🏛️ Server Records — ${guild.name}`).addFields(
        { name: "Highest Combo Ever", value: line(records.highestComboEver, v => `${v}`) },
        { name: "Longest Conversation", value: line(records.longestConversation, formatDuration) },
        { name: "Most Messages", value: line(records.mostMessages, v => `${v}`) },
        { name: "Highest Heat", value: line(records.highestHeat, v => `${Math.round(v)}%`) },
        { name: "Longest Conversation Streak", value: line(records.longestConversationStreak, v => `${v} day(s)`) },
    );
}

export async function buildSettingsEmbed(guild: Guild): Promise<EmbedBuilder> {
    const settings = await ComboSettingsRepository.get(guild.id);
    const roleId = settings?.championRoleId;
    const role = roleId ? guild.roles.cache.get(roleId) : null;

    return baseEmbed("⚙️ Combo Settings").addFields({
        name: "Champion Role",
        value: role ? `${role}` : "Not configured",
    });
}
