import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    MessageFlags,
    type StringSelectMenuInteraction,
    type RoleSelectMenuInteraction,
} from "discord.js";
import { COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod, type ComboLeaderboardType } from "@core/config";

export type ComboPage = "status" | "statistics" | "history" | "leaderboards" | "records" | "settings";

const PERIOD_LABELS: Record<ComboLeaderboardPeriod, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    alltime: "All Time",
};

const TYPE_LABELS: Record<ComboLeaderboardType, string> = {
    combo: "Highest Combo",
    streak: "Conversation Streak",
    partner: "Favorite Partner",
};

const COMBO_LEADERBOARD_TYPES: ComboLeaderboardType[] = ["combo", "streak", "partner"];

/** Only the invoking user may operate their own /combo message's components. */
export async function verifyInvoker(
    interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction,
    invokerId: string,
): Promise<boolean> {
    if (interaction.user.id === invokerId) return true;
    await interaction.reply({ content: "This isn't your combo menu.", flags: MessageFlags.Ephemeral }).catch(() => null);
    return false;
}

export function buildComboNavRow(invokerId: string, isAdmin: boolean): ActionRowBuilder<StringSelectMenuBuilder> {
    const options: { label: string; description: string; value: ComboPage; emoji: string }[] = [
        { label: "Status", description: "Your current combo status", value: "status", emoji: "🔥" },
        { label: "Statistics", description: "Detailed combo statistics", value: "statistics", emoji: "📊" },
        { label: "History", description: "Your past combos", value: "history", emoji: "📜" },
        { label: "Leaderboards", description: "Server combo leaderboards", value: "leaderboards", emoji: "🏆" },
        { label: "Server Records", description: "All-time server records", value: "records", emoji: "🏛️" },
    ];

    if (isAdmin) {
        options.push({ label: "Settings", description: "Configure the Champion role (Admins)", value: "settings", emoji: "⚙️" });
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`combo:nav:${invokerId}`)
        .setPlaceholder("Navigate...")
        .addOptions(options);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function buildComboLeaderboardRows(
    invokerId: string,
    period: ComboLeaderboardPeriod,
    type: ComboLeaderboardType,
): ActionRowBuilder<StringSelectMenuBuilder>[] {
    const periodMenu = new StringSelectMenuBuilder()
        .setCustomId(`combo:lb-period:${invokerId}:${type}`)
        .setPlaceholder("Period")
        .addOptions(COMBO_LEADERBOARD_PERIODS.map(p => ({ label: PERIOD_LABELS[p], value: p, default: p === period })));

    const typeMenu = new StringSelectMenuBuilder()
        .setCustomId(`combo:lb-type:${invokerId}:${period}`)
        .setPlaceholder("Leaderboard Type")
        .addOptions(COMBO_LEADERBOARD_TYPES.map(t => ({ label: TYPE_LABELS[t], value: t, default: t === type })));

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(periodMenu),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeMenu),
    ];
}

export function buildComboSettingsRow(invokerId: string): ActionRowBuilder<RoleSelectMenuBuilder> {
    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`combo:settings-role:${invokerId}`)
        .setPlaceholder("Select the Champion role...")
        .setMinValues(0)
        .setMaxValues(1);

    return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
}
