import { type GuildMember, type ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { COLORS } from "@constants";
import { hasGuildBotAdmin, isGuildOperator } from "@bot/utils/access";
import { applyBotProfile, BOT_PROFILE_MODAL_ID } from "@bot/utils/bot-profile/bot-profile-form";

const botProfileModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: BOT_PROFILE_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = interaction.member as GuildMember | null;
        if (!interaction.guild || !member || !(isGuildOperator(member) || await hasGuildBotAdmin(member))) {
            await interaction.editReply({
                embeds: [new EmbedBuilder().setDescription("❌ Only server admins can change the bot's profile.").setColor(COLORS.error)],
            });
            return;
        }

        const result = await applyBotProfile(interaction.guild, interaction);
        const embed = !result.ok
            ? new EmbedBuilder().setDescription(`❌ ${result.problem}`).setColor(COLORS.error)
            : result.changed.length
                ? new EmbedBuilder().setTitle("✅ Bot Profile Updated").setDescription(`Changed in this server: ${result.changed.join(", ")}.`).setColor(COLORS.success)
                : new EmbedBuilder().setDescription("Nothing changed.").setColor(COLORS.info);

        await interaction.editReply({ embeds: [embed] });
    },
};

export default botProfileModalHandler;
