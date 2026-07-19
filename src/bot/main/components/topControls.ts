import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    type StringSelectMenuInteraction,
    type GuildMember,
} from "discord.js";
import type { ComponentHandler } from "@core/config";
import { COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod } from "@core/config";
import { verifyInvoker } from "../utils/comboComponents";
import { buildTopEmbed, TOP_CATEGORIES, type TopCategory } from "../services/top-service";
import { getUserLang, t } from "@shared/utils/lang";
import type { Lang } from "@shared/utils/lang";

export function buildTopCategoryRow(invokerId: string, category: TopCategory, period: ComboLeaderboardPeriod, lang: Lang): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`top:category:${invokerId}:${period}`)
        .setPlaceholder(t("top.category_placeholder", lang))
        .addOptions(TOP_CATEGORIES.map(c => ({ label: t(`top.category_${c}`, lang), value: c, default: c === category })));

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function buildTopPeriodRow(invokerId: string, category: TopCategory, period: ComboLeaderboardPeriod, lang: Lang): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`top:period:${invokerId}:${category}`)
        .setPlaceholder(t("top.period_placeholder", lang))
        .addOptions(COMBO_LEADERBOARD_PERIODS.map(p => ({ label: t(`top.period_${p}`, lang), value: p, default: p === period })));

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

async function render(interaction: StringSelectMenuInteraction, invokerId: string, category: TopCategory, period: ComboLeaderboardPeriod): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferUpdate();

    const lang = await getUserLang(interaction.member as GuildMember | null);
    const embed = await buildTopEmbed(guild, category, period, lang, invokerId);

    await interaction.editReply({
        embeds: [embed],
        components: [buildTopCategoryRow(invokerId, category, period, lang), buildTopPeriodRow(invokerId, category, period, lang)],
    });
}

export const topCategoryHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: /^top:category:\d+:(daily|weekly|monthly|alltime)$/,

    async run(interaction: StringSelectMenuInteraction) {
        const parts = interaction.customId.split(":");
        const invokerId = parts[2];
        const period = parts[3] as ComboLeaderboardPeriod;
        if (!(await verifyInvoker(interaction, invokerId))) return;

        const category = interaction.values[0] as TopCategory;
        await render(interaction, invokerId, category, period);
    },
};

export const topPeriodHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: /^top:period:\d+:(streak|combo|xp|messages)$/,

    async run(interaction: StringSelectMenuInteraction) {
        const parts = interaction.customId.split(":");
        const invokerId = parts[2];
        const category = parts[3] as TopCategory;
        if (!(await verifyInvoker(interaction, invokerId))) return;

        const period = interaction.values[0] as ComboLeaderboardPeriod;
        await render(interaction, invokerId, category, period);
    },
};
