import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { StreakSettingsRepository } from "@database/repositories";

import { L } from "@utils";
/** Roles allowed to run `/streak-return`, on top of administrators. */
export const returnRoleAdd: FeatureSubcommandHandler = async (interaction, _client) => {
    const role = interaction.options.getRole("role", true);
    await StreakSettingsRepository.editReturnRole(interaction.guildId!, role.id, "add");
    await interaction.editReply({ content: L(`${role} can now return streaks.`, `${role} صار يقدر يرجع الستريك.`) });
};

export const returnRoleRemove: FeatureSubcommandHandler = async (interaction, _client) => {
    const role = interaction.options.getRole("role", true);
    await StreakSettingsRepository.editReturnRole(interaction.guildId!, role.id, "remove");
    await interaction.editReply({ content: L(`${role} can no longer return streaks.`, `${role} ما عاد يقدر يرجع الستريك.`) });
};

export const returnRoleList: FeatureSubcommandHandler = async (interaction, _client) => {
    const settings = await StreakSettingsRepository.get(interaction.guildId!);
    const roles = settings?.returnRoleIds ?? [];

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(L("Roles that may return streaks", "الرتب اللي تقدر ترجع الستريك"))
            .setColor(COLORS.info)
            .setDescription(roles.length ? roles.map(id => `<@&${id}>`).join("\n") : L("None: administrators only.", "لا يوجد: الإدارة فقط."))],
    });
};
