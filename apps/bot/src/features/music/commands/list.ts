import { EmbedBuilder, MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { MUSIC_CONFIG } from "@constants";
import { musicBotInviteUrl } from "@core/music";
import { MusicBotRepository } from "@database/repositories";
import { getMusicBot } from "../engine/music-manager";

/** `/music list` — this server's music bots, their channels, and whether each is running. */
export const list: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const bots = await MusicBotRepository.listByGuild(interaction.guildId!);
    if (!bots.length) {
        await interaction.editReply({ content: "No music bots yet. Add one with `/music create`." });
        return;
    }

    const lines = bots.map((bot, i) => {
        const instance = getMusicBot(bot.botId);
        const status = !instance?.online
            ? "🔴 offline"
            : instance.inGuild
                ? "🟢 online"
                : `🟡 not in the server — [invite it](${musicBotInviteUrl(bot.applicationId, bot.guildId)})`;
        return `**${i + 1}. ${bot.name}** · <@${bot.botId}> · <#${bot.voiceChannelId}> · ${status}`;
    });

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(MUSIC_CONFIG.embedColor)
            .setTitle(`🎵 Music bots (${bots.length}/${MUSIC_CONFIG.maxBotsPerGuild})`)
            .setDescription(lines.join("\n").slice(0, 4000))],
        allowedMentions: { parse: [] },
    });
};
