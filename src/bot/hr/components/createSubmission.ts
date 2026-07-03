import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalSubmitInteraction,
    MessageFlags,
    type TextChannel,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { ROLE_MAP } from "@core/config";
import { getQuestionsByDepartment } from "../config/questions";
import { getDepartmentEmbedConfig } from "../config/embeds";
import { StaffRepository, SubmitConfigRepository } from "@database/repositories";

function getManagerRoleId(department: Department): string | null {
    const entry = Object.entries(ROLE_MAP).find(
        ([key, v]) => v.department === department && key.includes("Manager")
    );
    return entry?.[1].ids[0] ?? null;
}

export default {
    customId: /^staff-submit_/,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        const parts = interaction.customId.split("_");
        const dep = parts[1] as Department;
        const questions = getQuestionsByDepartment(dep);
        const embedConfig = getDepartmentEmbedConfig(dep);

        if (!questions.length) {
            await interaction.reply({
                content: "❌ No questions configured for this department.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const config = await SubmitConfigRepository.get(interaction.guildId!);
        if (!config?.reviewChannelId) {
            await interaction.reply({
                content: "❌ The submission system is not configured. Please contact an administrator.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const reviewChannel = interaction.guild?.channels.cache.get(config.reviewChannelId) as TextChannel | undefined;
        if (!reviewChannel) {
            await interaction.reply({
                content: "❌ Review channel not found. Please contact an administrator.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const answers = questions.map(q => ({
            id: q.id,
            question: q.question,
            answer: interaction.fields.getTextInputValue(q.id),
        }));

        const embed = new EmbedBuilder()
            .setTitle(embedConfig.submissionTitle)
            .setDescription(`From <@${interaction.user.id}>`)
            .addFields(answers.map(a => ({ name: a.question, value: a.answer })))
            .setColor(embedConfig.submissionColor)
            .setTimestamp();

        const acceptBtn = new ButtonBuilder()
            .setCustomId(`staff-accept_${dep}_${interaction.user.id}`)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Success);

        const rejectBtn = new ButtonBuilder()
            .setCustomId(`staff-reject_${dep}_${interaction.user.id}`)
            .setLabel("Reject")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, rejectBtn);

        const managerRoleId = getManagerRoleId(dep);
        const ping = managerRoleId ? `<@&${managerRoleId}>` : "";

        await reviewChannel.send({
            content: ping || undefined,
            embeds: [embed],
            components: [row],
        });

        await StaffRepository.createSubmission({
            userId: interaction.user.id,
            department: dep,
            questions: answers,
        });

        await interaction.reply({
            content: "✅ Your application has been submitted! You will be notified once it is reviewed.",
            flags: MessageFlags.Ephemeral,
        });
    },
};
