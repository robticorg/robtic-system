import { StringSelectMenuInteraction, MessageFlags, type GuildMember } from "discord.js";
import type { ComponentHandler } from "@core/config";
import type { BotClient } from "@core/BotClient";
import { isAnyManager } from "@shared/utils/access";
import {
    buildStatusEmbed,
    buildStatisticsEmbed,
    buildHistoryEmbed,
    buildLeaderboardEmbed,
    buildServerRecordsEmbed,
    buildSettingsEmbed,
} from "../utils/comboEmbeds";
import {
    buildComboNavRow,
    buildComboLeaderboardRows,
    buildComboSettingsRow,
    verifyInvoker,
    type ComboPage,
} from "../utils/comboComponents";

export const comboMenuHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: /^combo:nav:\d+$/,

    async run(interaction: StringSelectMenuInteraction, _client: BotClient) {
        const invokerId = interaction.customId.split(":")[2];
        if (!(await verifyInvoker(interaction, invokerId))) return;

        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        await interaction.deferUpdate();

        const page = interaction.values[0] as ComboPage;
        const member = interaction.member as GuildMember | null;
        const isAdmin = member ? isAnyManager(member) : false;

        if (page === "settings" && !isAdmin) {
            await interaction.followUp({ content: "You don't have permission to view combo settings.", flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        const target = {
            id: interaction.user.id,
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ size: 256 }),
        };

        const nav = buildComboNavRow(invokerId, isAdmin);

        switch (page) {
            case "status": {
                const embed = await buildStatusEmbed(guild, target);
                await interaction.editReply({ embeds: [embed], components: [nav] });
                return;
            }
            case "statistics": {
                const embed = await buildStatisticsEmbed(guild, target);
                await interaction.editReply({ embeds: [embed], components: [nav] });
                return;
            }
            case "history": {
                const embed = await buildHistoryEmbed(guild, target);
                await interaction.editReply({ embeds: [embed], components: [nav] });
                return;
            }
            case "leaderboards": {
                const embed = await buildLeaderboardEmbed(guild, "daily", "combo");
                const lbRows = buildComboLeaderboardRows(invokerId, "daily", "combo");
                await interaction.editReply({ embeds: [embed], components: [nav, ...lbRows] });
                return;
            }
            case "records": {
                const embed = await buildServerRecordsEmbed(guild);
                await interaction.editReply({ embeds: [embed], components: [nav] });
                return;
            }
            case "settings": {
                const embed = await buildSettingsEmbed(guild);
                const settingsRow = buildComboSettingsRow(invokerId);
                await interaction.editReply({ embeds: [embed], components: [nav, settingsRow] });
                return;
            }
        }
    },
};
