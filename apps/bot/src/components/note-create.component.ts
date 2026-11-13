import {
    ModalSubmitInteraction,
    MessageFlags,
} from "discord.js";

import type { ComponentHandler } from "@typings/command";
import { NoteRepository } from "@database/repositories/NoteRepository";

import { L } from "@utils";
const noteCreate: ComponentHandler<ModalSubmitInteraction> = {
    customId: /^note_create_\d+$/,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userId = interaction.customId.replace("note_create_", "");
        const content = interaction.fields.getTextInputValue("note_content");

        await NoteRepository.create(userId, content, interaction.user.id);

        await interaction.editReply({
            content: L(`✅ Note added for <@${userId}>.`, `✅ تمت إضافة ملاحظة على <@${userId}>.`),
        });
    },
};

export default noteCreate;
