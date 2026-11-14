import { EmbedBuilder, MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { MUSIC_CONFIG } from "@constants";
import { listMusicBots, musicBotInviteUrl } from "@core/music";

import { L } from "@utils";
/** `/music list` — this server's music bots, their channels, and whether each is running. */
export const list: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const bots = await listMusicBots(interaction.guildId!);

    if (!bots.length) {
        await interaction.editReply({ content: L("No music bots yet. Add them on the RobTic Music dashboard.", "لا توجد بوتات موسيقى بعد. يمكنك إضافتها من لوحة RobTic Music.") });
        return;
    }

    const lines = bots.map((bot, i) => {
        const status = bot.status === "offline"
            ? "🔴 offline"
            : bot.status === "online"
                ? "🟢 online"
                : `🟡 not in the server — [invite it](${musicBotInviteUrl(bot.applicationId, bot.guildId, bot.mode)})`;
        return `**${i + 1}. ${bot.name}** · <@${bot.botId}> · ${bot.voiceChannelId ? `<#${bot.voiceChannelId}>` : L("moves between channels", "يتنقل بين الرومات")} · ${status}`;
    });

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(MUSIC_CONFIG.embedColor)
            .setTitle(L(`🎵 Music bots (${bots.length}/${MUSIC_CONFIG.maxBotsPerGuild})`, `🎵 بوتات الموسيقى (${bots.length}/${MUSIC_CONFIG.maxBotsPerGuild})`))
            .setDescription(lines.join("\n").slice(0, 4000))],
        allowedMentions: { parse: [] },
    });
};
