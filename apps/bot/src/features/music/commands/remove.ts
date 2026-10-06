import { MessageFlags, type AutocompleteInteraction } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { MusicBotRepository } from "@database/repositories";
import { InternalApiError, unavailableMessage } from "@internal-client";
import { Logger } from "@logger";
import { musicBackend } from "../utils/music-backend";

/**
 * `/bot remove bot:` — the music bot leaves the server, goes offline, loses its voice-channel
 * permissions, and its encrypted token is deleted. Only this server's bots can be picked.
 */
export const remove: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild!;

    const botId = interaction.options.getString("bot", true);
    let record;
    try {
        record = await musicBackend.remove(guild.id, botId);
    } catch (err) {
        if (err instanceof InternalApiError) return void await interaction.editReply({ content: unavailableMessage("music") });
        throw err;
    }
    if (!record) {
        await interaction.editReply({ content: "No such music bot on this server — pick one from the list." });
        return;
    }

    const channel = guild.channels.cache.get(record.voiceChannelId);
    if (channel && "permissionOverwrites" in channel) {
        await channel.permissionOverwrites.delete(botId, "Music bot removed").catch(() => null);
    }

    Logger.info(`Music bot ${record.name} (${botId}) removed from ${guild.id} by ${interaction.user.id}`, "music");
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
