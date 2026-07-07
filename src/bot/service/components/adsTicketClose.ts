import { ButtonInteraction, MessageFlags, type TextChannel } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { TicketRepository } from "@database/repositories";

export default {
    customId: /^ads-ticket-close_/,

    async run(interaction: ButtonInteraction, client: BotClient) {
        const ticketId = interaction.customId.slice("ads-ticket-close_".length);

        const ticket = await TicketRepository.findById(ticketId);
        if (!ticket) {
            await interaction.reply({ content: "❌ This ticket no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (ticket.status === "closed") {
            await interaction.reply({ content: "⚠️ This ticket is already closed.", flags: MessageFlags.Ephemeral });
            return;
        }

        await TicketRepository.close(ticketId, interaction.user.id);

        const channel = interaction.channel as TextChannel;
        await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false }).catch(() => {});

        await interaction.reply({
            content: `🔒 تم إغلاق هذه التذكرة بواسطة <@${interaction.user.id}>.`,
        });
    },
};
