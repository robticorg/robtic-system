import { ButtonInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdOrderRepository, AdsConfigRepository, ActivityRepository, TicketRepository } from "@database/repositories";
import { buildAdsTicketCard } from "../utils/adsTicket";

export default {
    customId: /^ads-ticket-claim_/,

    async run(interaction: ButtonInteraction, client: BotClient) {
        const ticketId = interaction.customId.slice("ads-ticket-claim_".length);
        const guildId = interaction.guildId!;

        const ticket = await TicketRepository.findById(ticketId);
        if (!ticket) {
            await interaction.reply({ content: "❌ This ticket no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (ticket.assignedTo) {
            await interaction.reply({
                content: `⚠️ This ticket is already claimed by <@${ticket.assignedTo}>.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const order = await AdOrderRepository.get(guildId, ticketId);
        if (!order) {
            await interaction.reply({ content: "❌ The order behind this ticket no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        await TicketRepository.assign(ticketId, interaction.user.id);
        await ActivityRepository.addSupportPoints(interaction.user.id, guildId, 1);

        const config = await AdsConfigRepository.get(guildId);
        await interaction.update({
            ...buildAdsTicketCard(order, config.exchangeRate, ticketId, interaction.user.id),
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
