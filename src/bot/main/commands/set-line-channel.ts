import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    ChannelType,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors } from "@core/config";
import { ServerConfigRepository } from "@database/repositories";

export default {
    data: new SlashCommandBuilder()
        .setName("set-line-channel")
        .setDescription("Set the channel that auto-attaches the line image and reacts to every message")
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("The channel to use as the line channel")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    requiredPermission: 100,
    department: "Management" as Department,

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guildId) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setDescription("❌ This command can only be used in a server.")
                    .setColor(Colors.error)],
            });
            return;
        }

        const channel = interaction.options.getChannel("channel", true);

        await ServerConfigRepository.setLineChannel(interaction.guildId, channel.id);

        const embed = new EmbedBuilder()
            .setTitle("✅ Line Channel Set")
            .setColor(Colors.success)
            .setDescription(`Every message sent in <#${channel.id}> will now automatically get the line image attached and reacted to.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
