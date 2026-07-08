import { resultChannelId, STAFF_TRAINEE_ROLE_ID } from "../config/departments";
import { STAFF_TEAM_ROLE_ID } from "@core/config/constants";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { StaffRepository, SubmissionTypeRepository } from "@database/repositories";
import { interviewCollectors } from "../utils/interviewCollectors";
import { hasFullPower } from "@shared/utils/access";

export default {
  data: new SlashCommandBuilder()
    .setName("interview")
    .setDescription("interview command")
    .addSubcommand((sub) =>
      sub.setName("accept").setDescription("Accept the interview"),
    )
    .addSubcommand((sub) =>
      sub.setName("reject").setDescription("Reject the interview"),
    ),

  async run(interaction: ChatInputCommandInteraction, client: BotClient) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();

    const data = await StaffRepository.getSubmissionByThreadId(
      interaction.channelId,
    );

    if (!data) {
      return await interaction.editReply({
        content: "❌ | Interview not found",
      });
    }

    const type = await SubmissionTypeRepository.get(interaction.guildId!, data.department);
    const manager = interaction.member as GuildMember;
    const isManager = type?.managerRoleIds.some((id) => manager.roles.cache.has(id)) ?? false;

    if (!isManager && !hasFullPower(manager)) {
      return await interaction.editReply({
        content: "❌ | You don't have permission to decide on this interview.",
      });
    }

    const user = await client.users.fetch(data.userId);
    const member = await interaction.guild?.members.fetch(data.userId);

    const collectors = interviewCollectors.get(data.userId);
    if (collectors) {
      collectors.DMCollector.stop();
      collectors.thrCollector.stop();
      interviewCollectors.delete(data.userId);
    }

    if (sub === "accept") {
      await member?.roles.add([
        ...(type?.grantRoleIds ?? []),
        STAFF_TEAM_ROLE_ID,
        STAFF_TRAINEE_ROLE_ID,
      ]);

      await StaffRepository.deleteSubmission(data.userId);

      await interaction.editReply({
        content: "✅ | Submission accepted",
      });

      user.send("Your submission has been accepted");
    }

    if (sub === "reject") {
      if (data.isApproved) {
        return interaction.editReply({
          content: "❌ | This submission was accepted. You can’t reject it now",
        });
      }

      await StaffRepository.deleteSubmission(user.id);

      await interaction.editReply({
        content: "✅ | Submission rejected",
      });

      user.send("Your submission has been rejected");
    }

    const embed = new EmbedBuilder()
      .setTitle(
        sub === "accept" ? "✅ Interview Accepted" : "❌ Interview Rejected",
      )
      .addFields(
        { name: "Submission Type", value: type?.name ?? data.department },
        { name: "Submitter", value: `<@${data.userId}>` },
        { name: "Manager", value: `<@${interaction.user.id}>` },
      )
      .setColor(sub === "accept" ? "Green" : "Red")
      .setTimestamp();

    const resultChannel = interaction.guild?.channels.cache.get(resultChannelId);
    if (!resultChannel?.isTextBased()) return;
    resultChannel?.send({
      embeds: [embed],
    });
  },
};
