import {
    type StringSelectMenuInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";

const MOD_CHANNEL_LABELS: Record<string, string> = {
    modmail: "ModMail Channel",
};

const setModChannelSelectHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: /^set_mod_channel_select$/,

    async run(interaction: StringSelectMenuInteraction, _client: BotClient) {
        const type = interaction.values[0];
        const label = MOD_CHANNEL_LABELS[type] ?? type;

        const modal = new ModalBuilder()
            .setCustomId(`set_mod_channel_modal_${type}`)
            .setTitle(`Set ${label}`);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("channel_id")
                    .setLabel("Channel ID")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder("Enter the channel ID (numbers only)")
                    .setMinLength(17)
                    .setMaxLength(20)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("server_id")
                    .setLabel("Server ID (optional — defaults to this server)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder("Leave empty to use this server")
                    .setMinLength(17)
                    .setMaxLength(20)
            ),
        );

        await interaction.showModal(modal);
    },
};

export default setModChannelSelectHandler;
