import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { StreakRepository } from "@database/repositories";

import { L } from "@utils";
/**
 * Copies streaks in from another server the bot is in.
 *
 * Confirmation is a separate button rather than an option flag because the merge is bulk and
 * irreversible — the count in the prompt is the only chance to notice a wrong source guild.
 */
export const sync: FeatureSubcommandHandler = async (interaction, client) => {
    const guildId = interaction.guildId!;
    const sourceGuildId = interaction.options.getString("source-guild-id", true).trim();

    if (sourceGuildId === guildId) {
        await interaction.editReply({ content: L("A server can't sync with itself.", "ما ينفع تزامن السيرفر مع نفسه.") });
        return;
    }

    const sourceGuild = client.guilds.cache.get(sourceGuildId);
    if (!sourceGuild) {
        await interaction.editReply({ content: L("I'm not in the source server.", "البوت غير موجود في السيرفر المصدر.") });
        return;
    }

    const count = await StreakRepository.countGuild(sourceGuildId);
    if (count === 0) {
        await interaction.editReply({ content: L(`**${sourceGuild.name}** has no streaks.`, `ما في ستريكات في **${sourceGuild.name}**.`) });
        return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`streak-sync-confirm_${interaction.user.id}_${sourceGuildId}`)
            .setLabel(L("Sync", "تأكيد المزامنة"))
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`streak-sync-cancel_${interaction.user.id}`)
            .setLabel(L("Cancel", "إلغاء"))
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(L("⚠️ Sync streaks?", "⚠️ تأكيد مزامنة الستريك"))
            .setColor(COLORS.warning)
            .setDescription(
                L(`**${count}** streaks will be copied from **${sourceGuild.name}** to this server.\n`, `بيتم نسخ **${count}** ستريك من **${sourceGuild.name}** لهذا السيرفر.\n`) +
                L(`Where both have one, the higher is kept. Streak roles update by themselves.`, `عند التعارض تنحفظ القيمة الأعلى، ورتب الستريك تتحدث تلقائياً.`)
            )],
        components: [row],
    });
};
