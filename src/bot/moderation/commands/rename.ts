import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, type TextChannel } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { requireOpenTicket, requireTicketStaff } from "../utils/ticketGuard";

export default {
    data: new SlashCommandBuilder()
        .setName("rename")
        .setDescription("Rename the current ticket channel")
        .addStringOption(opt => opt.setName("name").setDescription("New name for the ticket").setRequired(true)),

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        const resolved = await requireOpenTicket(interaction);
        if (!resolved) return;
        if (!(await requireTicketStaff(interaction, resolved.category))) return;

        const rawName = interaction.options.getString("name", true);
        const sanitized = rawName
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 90);

        if (!sanitized) {
            await interaction.reply({ content: "That name isn't usable for a channel — try letters, numbers, or dashes.", flags: MessageFlags.Ephemeral });
            return;
        }

        const channel = interaction.channel as TextChannel;
        await channel.setName(`ticket-${sanitized}`);

        await interaction.reply({ content: `✅ Renamed this ticket to **ticket-${sanitized}**.`, flags: MessageFlags.Ephemeral });
    },
};
