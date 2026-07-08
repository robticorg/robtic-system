import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors } from "@core/config";
import { GlobalConfigRepository } from "@database/repositories";

export default {
    data: new SlashCommandBuilder()
        .setName("set-log-guild")
        .setDescription("Set the centralized server log guild")
        .addStringOption(opt =>
            opt.setName("id")
                .setDescription("The guild ID to use as the log server")
                .setRequired(true)
                .setMinLength(17)
                .setMaxLength(20)
        ),

    requiredPermission: 100,
    department: "Management" as Department,

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.options.getString("id", true).trim();

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setDescription(`❌ Bot is not in guild \`${guildId}\`. Make sure the bot is a member of that server.`)
                    .setColor(Colors.error)],
            });
            return;
        }

        const previous = await GlobalConfigRepository.get("server_log_guild");
        await GlobalConfigRepository.set("server_log_guild", guildId);

        const embed = new EmbedBuilder()
            .setTitle("✅ Server Log Guild Set")
            .setColor(Colors.success)
            .addFields(
                { name: "Guild", value: `${guild.name} (\`${guildId}\`)` },
                { name: "Categories", value: "Name each category after the server ID you want to log from", inline: false },
                { name: "Channels", value: "Inside each category, create channels named:\n`member-join` `member-leave` `member-role-update`\n`role-create` `role-delete` `role-update`\n`channel-create` `channel-delete` `channel-update`\n`message-delete` `message-update`", inline: false },
            )
            .setTimestamp();

        if (previous && previous !== guildId) {
            const prevGuild = client.guilds.cache.get(previous);
            embed.addFields({ name: "Previous", value: prevGuild ? `${prevGuild.name} (\`${previous}\`)` : `\`${previous}\`` });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
