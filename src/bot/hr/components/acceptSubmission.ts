import {
  ButtonInteraction,
  TextChannel,
  DMChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ActionRow,
  MessageFlags,
  type MessageActionRowComponent,
  ButtonComponent,
  type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { startInterview } from "../utils/startInterview";
import { Submission } from "@database/models/Submission";
import { SubmissionTypeRepository } from "@database/repositories";
import { hasFullPower } from "@shared/utils/access";

export default {
  customId: /^staff-accept_/,
  async run(interaction: ButtonInteraction, client: BotClient) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split("_");
    const key = parts[1];
    const userId = parts[2];

    const type = await SubmissionTypeRepository.get(interaction.guildId!, key);
    if (!type) {
      await interaction.followUp({ content: "❌ This submission type no longer exists.", flags: MessageFlags.Ephemeral });
      return;
    }

    const member = interaction.member as GuildMember;
    const isManager = type.managerRoleIds.some(id => member.roles.cache.has(id));
    if (!isManager && !hasFullPower(member)) {
      await interaction.followUp({ content: "❌ You don't have permission to accept this submission.", flags: MessageFlags.Ephemeral });
      return;
    }

    const user = await client.users.fetch(userId);

    const firstRow = interaction.message.components[0] as ActionRow<MessageActionRowComponent>;
    const components = firstRow.components;

    const acceptBtn = components[0];
    const rejectBtn = components[1];

    if (acceptBtn?.type !== 2 || rejectBtn?.type !== 2) return;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonBuilder.from(acceptBtn as ButtonComponent).setDisabled(true),
      ButtonBuilder.from(rejectBtn as ButtonComponent).setDisabled(true)
    );
    await interaction.editReply({ components: [row] });

    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    const thr = await channel.threads.create({
      name: `Interview | ${type.name} | ${user.displayName}`,
      startMessage: interaction.message,
    });
    thr.send(`Interview manager: <@${interaction.user.id}>`);

    await Submission.findOneAndUpdate(
      { userId },
      {
        threadId: thr.id,
      },
    );

    const m = await user.send(
      "Your submission was accepted\nSend a message to start the 5-minute interview",
    );

    const DM = m.channel as DMChannel;

    const collector = DM.createMessageCollector({
      filter: (msg) => !msg.author.bot,
      max: 1,
      time: 300000,
    });

    collector.on("collect", async (m) => {
      await thr.send(`<@${interaction.user.id}>, Interview started`);
      await thr.send(m.content);
      startInterview(client, thr, DM, userId, interaction.user.id, type.key);
    });
  },
};
