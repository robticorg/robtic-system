import {
    StringSelectMenuInteraction,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { getQuestionsByDepartment } from "../config/questions";
import { StaffRepository } from "@database/repositories";

export default {
    customId: "staff-apply-select",

    async run(interaction: StringSelectMenuInteraction, client: BotClient) {
        const dep = interaction.values[0] as Department;
        const questions = getQuestionsByDepartment(dep);

        if (!questions.length) {
            await interaction.reply({
                content: "❌ No questions configured for this department.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const existing = await StaffRepository.getSubmission(interaction.user.id);
        if (existing) {
            await interaction.reply({
                content: "❌ You already have an active submission. Please wait for it to be reviewed.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`staff-submit_${dep}`)
            .setTitle(`${dep} Department Application`)
            .addComponents(
                questions.map(q =>
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId(q.id)
                            .setLabel(q.question)
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                )
            );

        await interaction.showModal(modal);
    },
};
