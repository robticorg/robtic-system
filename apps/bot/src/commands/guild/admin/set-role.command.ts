import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from "discord.js";
import type { BotClient } from "@core/bot-client";

import { L, bilingual } from "@utils";
const ROLE_LABELS = bilingual<Record<string, string>>(
    { en: "English role", ar: "Arabic role", members: "Members role", bots: "Bots role" },
    { en: "رتبة الإنجليزي", ar: "رتبة العربي", members: "رتبة الأعضاء", bots: "رتبة البوتات" },
);

export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("set-role")
        .setDescription("Configure a role for this server")
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("The role type to configure")
                .setRequired(true)
                .addChoices(
                    { name: "English Role", value: "en" },
                    { name: "Arabic Role", value: "ar" },
                    { name: "Members Role", value: "members" },
                    { name: "Bots Role", value: "bots" },
                )
        ),

    requiredPermission: 100,
    modalOnly: true,

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        const type = interaction.options.getString("type", true);
        const label = ROLE_LABELS[type] ?? type;

        const modal = new ModalBuilder()
            .setCustomId(`set_role_modal_${type}`)
            .setTitle(L(`Set ${label}`.slice(0, 45), `ضبط ${label}`.slice(0, 45)));

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("role_id")
                    .setLabel(L("Role ID", "آيدي الرتبة"))
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder(L("Enter the role ID (numbers only)", "آيدي الرتبة (أرقام فقط)"))
                    .setMinLength(17)
                    .setMaxLength(20)
            ),
        );

        await interaction.showModal(modal);
    },
};
