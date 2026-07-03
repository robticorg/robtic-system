import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { NoteRepository } from "@database/repositories/NoteRepository";

const appealNoteSubmit: ComponentHandler<ModalSubmitInteraction> = {
    customId: /^appeal_note_submit_[A-Za-z0-9-]+_\d+$/,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        const parts = interaction.customId.split("_");
        const caseId = parts[3];
        const userId = parts[4];
        const content = interaction.fields.getTextInputValue("note_content").trim();

        await NoteRepository.create(userId, `[Appeal ${caseId}] ${content}`, interaction.user.id);

        await interaction.reply({
            embeds: [new EmbedBuilder().setDescription(`📝 Note added for <@${userId}>.`).setColor(Colors.success)],
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default appealNoteSubmit;
