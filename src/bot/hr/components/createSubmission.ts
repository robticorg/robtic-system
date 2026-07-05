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
import { Colors } from "@core/config";
import { StaffRepository, SubmitConfigRepository, SubmissionTypeRepository } from "@database/repositories";

export default {
    customId: /^staff-submit_/,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        const key = interaction.customId.slice("staff-submit_".length);
        const guildId = interaction.guildId!;
        const type = await SubmissionTypeRepository.get(guildId, key);

        if (!type || !type.questions.length) {
            await interaction.reply({
                content: "❌ No questions configured for this submission type.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const config = await SubmitConfigRepository.get(guildId);
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

        const answers = type.questions.map(q => ({
            id: q.id,
            question: q.question,
            answer: interaction.fields.getTextInputValue(q.id),
        }));

        const embed = new EmbedBuilder()
            .setTitle(`New ${type.name} Submission`)
            .setDescription(`From <@${interaction.user.id}>`)
            .addFields(answers.map(a => ({ name: a.question, value: a.answer })))
            .setColor(Colors.hr)
            .setTimestamp();

        const acceptBtn = new ButtonBuilder()
            .setCustomId(`staff-accept_${type.key}_${interaction.user.id}`)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Success);

        const rejectBtn = new ButtonBuilder()
            .setCustomId(`staff-reject_${type.key}_${interaction.user.id}`)
            .setLabel("Reject")
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, rejectBtn);

        const ping = type.managerRoleIds.map(id => `<@&${id}>`).join(" ");

        await reviewChannel.send({
            content: ping || undefined,
            embeds: [embed],
            components: [row],
        });

        await StaffRepository.createSubmission({
            userId: interaction.user.id,
            department: type.key,
            questions: answers,
        });

        await interaction.reply({
            content: "✅ Your application has been submitted! You will be notified once it is reviewed.",
            flags: MessageFlags.Ephemeral,
        });
    },
};
