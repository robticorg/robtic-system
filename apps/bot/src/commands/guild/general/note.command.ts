import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from "discord.js";

import { L } from "@utils";
export default {
    scope: "guild",
    access: "general",
    category: "Utility",
    data: new SlashCommandBuilder()
        .setName("note")
        .setDescription("Add a note about a user")
        .addUserOption(opt =>
            opt.setName("user").setDescription("The user to add a note for").setRequired(true)
        ),

    modalOnly: true,

    async run(interaction: ChatInputCommandInteraction) {
        const targetUser = interaction.options.getUser("user", true);

        const modal = new ModalBuilder()
            .setCustomId(`note_create_${targetUser.id}`)
            .setTitle(L(`Add a note: ${targetUser.username}`.slice(0, 45), `إضافة ملاحظة: ${targetUser.username}`.slice(0, 45)));

        const contentInput = new TextInputBuilder()
            .setCustomId("note_content")
            .setLabel(L("Note", "ملاحظة"))
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(L("Write your note about this user...", "اكتب ملاحظتك عن هذا العضو..."))
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
        );

        await interaction.showModal(modal);
    },
};
