import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS } from "@constants";
import { Logger } from "@logger";
import { GlobalConfigRepository } from "@database/repositories";
import { SERVER_LOG_CHANNELS } from "@constants";
import { ensureServerLogChannels } from "@bot/utils/server-log";

import { L } from "@utils";
export default {
    scope: "admin",
    category: "Configuration",
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

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.options.getString("id", true).trim();

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setDescription(L(`❌ I'm not in server \`${guildId}\`. Add me there first.`, `❌ أنا مو موجود في السيرفر \`${guildId}\`. أضفني هناك أول.`))
                    .setColor(COLORS.error)],
            });
            return;
        }

        const previous = await GlobalConfigRepository.get("server_log_guild");
        await GlobalConfigRepository.set("server_log_guild", guildId);

        let backfilled = 0;
        for (const sourceGuild of client.guilds.cache.values()) {
            if (sourceGuild.id === guildId) continue;
            try {
                await ensureServerLogChannels(guild, sourceGuild.id, sourceGuild.name);
                backfilled++;
            } catch (err) {
                Logger.error(`Failed to backfill log channels for guild ${sourceGuild.id}: ${err}`, "set-log-guild");
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(L("✅ Log server set", "✅ تم ضبط سيرفر اللوقات"))
            .setColor(COLORS.success)
            .addFields(
                { name: "Guild", value: `${guild.name} (\`${guildId}\`)` },
                { name: L("Categories", "الكاتيقوريات"), value: L("One category per server ID, created automatically the moment the bot joins that server.", "كاتيقوري لكل سيرفر، تنسوى تلقائياً لحظة دخول البوت."), inline: false },
                { name: L("Channels", "الرومات"), value: L(`Auto-created inside each category:\n${SERVER_LOG_CHANNELS.map(c => `\`${c}\``).join(" ")}`, `تنسوى داخل كل كاتيقوري:\n${SERVER_LOG_CHANNELS.map(c => `\`${c}\``).join(" ")}`), inline: false },
                { name: L("Backfill", "السيرفرات الحالية"), value: L(`Provisioned ${backfilled} existing server(s) the bot is already in.`, `تم تجهيز ${backfilled} سيرفر البوت موجود فيها.`), inline: false },
            )
            .setTimestamp();

        if (previous && previous !== guildId) {
            const prevGuild = client.guilds.cache.get(previous);
            embed.addFields({ name: "Previous", value: prevGuild ? `${prevGuild.name} (\`${previous}\`)` : `\`${previous}\`` });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
