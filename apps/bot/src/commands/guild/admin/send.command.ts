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

import { L } from "@utils";
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
            .setTitle(L("Send a message", "إرسال رسالة"))
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel("Channel")
                    .setDescription(L("Where to send it", "وين ترسلها"))
                    .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
                        .setCustomId(SEND_FIELDS.channel)
                        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setRequired(true)),
                new LabelBuilder()
                    .setLabel("Message")
                    .setDescription(L("Markdown works. Up to 2000 characters, or 4000 as Components V2", "الماركداون يشتغل. حتى 2000 حرف، أو 4000 بنظام Components V2"))
                    .setTextInputComponent(new TextInputBuilder()
                        .setCustomId(SEND_FIELDS.message)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(4000)),
                new LabelBuilder()
                    .setLabel(L("Send as Components V2", "إرسال بنظام Components V2"))
                    .setDescription(L("Shows the message inside a card instead of as plain text", "تظهر الرسالة داخل بطاقة بدل نص عادي"))
                    .setCheckboxComponent(new CheckboxBuilder().setCustomId(SEND_FIELDS.componentsV2).setDefault(false)),
            ));
    },
};
