import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS } from "@constants";
import { ClientManager } from "@core/client-manager";
import { Logger } from "@logger";
import { GlobalConfigRepository } from "@database/repositories";
import { SERVER_LOG_CHANNELS } from "@constants";
import { ensureServerLogChannels } from "@shared/utils/server-log";

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
                    .setColor(COLORS.error)],
            });
            return;
        }

        const previous = await GlobalConfigRepository.get("server_log_guild");
        await GlobalConfigRepository.set("server_log_guild", guildId);

        // Backfill: provision log categories/channels for every server the moderation bot is
        // already in, not just ones it joins from now on.
        const modClient = ClientManager.getInstance().getClient("moderation");
        const logGuild = modClient?.guilds.cache.get(guildId);
        let backfilled = 0;
        if (logGuild) {
            for (const sourceGuild of modClient!.guilds.cache.values()) {
                if (sourceGuild.id === guildId) continue;
                try {
                    await ensureServerLogChannels(logGuild, sourceGuild.id, sourceGuild.name);
                    backfilled++;
                } catch (err) {
                    Logger.error(`Failed to backfill log channels for guild ${sourceGuild.id}: ${err}`, "set-log-guild");
                }
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ Server Log Guild Set")
            .setColor(COLORS.success)
            .addFields(
                { name: "Guild", value: `${guild.name} (\`${guildId}\`)` },
                { name: "Categories", value: "One category per server ID, created automatically the moment the moderation bot joins that server.", inline: false },
                { name: "Channels", value: `Auto-created inside each category:\n${SERVER_LOG_CHANNELS.map(c => `\`${c}\``).join(" ")}`, inline: false },
                {
                    name: "Backfill",
                    value: modClient
                        ? logGuild
                            ? `Provisioned ${backfilled} existing server(s) the moderation bot is already in.`
                            : "⚠️ The moderation bot isn't in this guild — it needs to be a member here to create the log channels."
                        : "⚠️ Moderation bot isn't running — backfill skipped, but new joins will still be provisioned automatically.",
                    inline: false,
                },
            )
            .setTimestamp();

        if (previous && previous !== guildId) {
            const prevGuild = client.guilds.cache.get(previous);
            embed.addFields({ name: "Previous", value: prevGuild ? `${prevGuild.name} (\`${previous}\`)` : `\`${previous}\`` });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
