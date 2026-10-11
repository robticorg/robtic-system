import {
    SlashCommandBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    CheckboxBuilder,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ChatInputCommandInteraction,
} from "discord.js";

import { SEND_FIELDS, SEND_MODAL_ID } from "@bot/utils/send/send-form";

/** `/send` — a form: the channel, the message, and whether to send it as Components V2. Sent as the bot. */
export default {
    scope: "guild",
    access: "admin",
    category: "Utility",
    data: new SlashCommandBuilder()
        .setName("send")
        .setDescription("Send a message as the bot to any channel"),

    modalOnly: true,

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.showModal(new ModalBuilder()
            .setCustomId(SEND_MODAL_ID)
            .setTitle("Send a Message")
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel("Channel")
                    .setDescription("Where to send it")
                    .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
                        .setCustomId(SEND_FIELDS.channel)
                        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setRequired(true)),
                new LabelBuilder()
                    .setLabel("Message")
                    .setDescription("Markdown works. Up to 2000 characters, or 4000 as Components V2")
                    .setTextInputComponent(new TextInputBuilder()
                        .setCustomId(SEND_FIELDS.message)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(4000)),
                new LabelBuilder()
                    .setLabel("Send as Components V2")
                    .setDescription("Shows the message inside a card instead of as plain text")
                    .setCheckboxComponent(new CheckboxBuilder().setCustomId(SEND_FIELDS.componentsV2).setDefault(false)),
            ));
    },
};
