import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { PartnerRepository } from "@database/repositories";
import { errorEmbed } from "@core/utils";
import { PARTNER_ROLE_NAME } from "../utils/partnerRole";

const partnerRemoveModal: ComponentHandler<ModalSubmitInteraction> = {
    customId: "partner_remove_modal",

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const partnerServerId = interaction.fields.getTextInputValue("partner_server_id").trim();
        const removed = await PartnerRepository.deleteByServerId(partnerServerId);

        if (!removed) {
            await interaction.editReply({ embeds: [errorEmbed("No partner found with that server ID.")] });
            return;
        }

        if (interaction.guild) {
            const member = await interaction.guild.members.fetch(removed.repUserId).catch(() => null);
            const role = interaction.guild.roles.cache.find(
                (r) => r.name.toLowerCase() === PARTNER_ROLE_NAME.toLowerCase()
            );
            if (member && role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role).catch(() => null);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ Partner Removed")
            .setColor(Colors.success)
            .addFields(
                { name: "Server", value: removed.partnerServerName, inline: true },
                { name: "Server ID", value: removed.partnerServerId, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};

export default partnerRemoveModal;
