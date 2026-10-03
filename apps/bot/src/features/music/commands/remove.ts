import { MessageFlags, type AutocompleteInteraction } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { MusicBotRepository } from "@database/repositories";
import { Logger } from "@logger";
import { getMusicBot, stopMusicBot } from "../engine/music-manager";

/**
 * `/bot remove bot:` — the music bot leaves the server, goes offline, loses its voice-channel
 * permissions, and its encrypted token is deleted. Only this server's bots can be picked.
 */
export const remove: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild!;

    const record = await MusicBotRepository.delete(guild.id, interaction.options.getString("bot", true));
    if (!record) {
        await interaction.editReply({ content: "No such music bot on this server — pick one from the list." });
        return;
    }

    await getMusicBot(record.botId)?.leaveGuild();
    await stopMusicBot(record.botId);

    const channel = guild.channels.cache.get(record.voiceChannelId);
    if (channel && "permissionOverwrites" in channel) {
        await channel.permissionOverwrites.delete(record.botId, "Music bot removed").catch(() => null);
    }

    Logger.info(`Music bot ${record.name} (${record.botId}) removed from ${guild.id} by ${interaction.user.id}`, "music");
    await interaction.editReply({ content: `**${record.name}** was removed: it left the server and its token was deleted.` });
};

/** This server's music bots by name; the value sent back is the bot id. */
export async function musicBotAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused().toLowerCase();
    const bots = await MusicBotRepository.listByGuild(interaction.guildId!);
    await interaction.respond(bots
        .filter(b => b.name.toLowerCase().includes(focused) || b.botId.includes(focused))
        .slice(0, 25)
        .map(b => ({ name: `${b.name} (${b.botId})`.slice(0, 100), value: b.botId })));
}
