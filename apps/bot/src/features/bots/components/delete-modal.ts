import { MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { removeMusicBot } from "@core/music";
import { Logger } from "@logger";
import { deleteMinecraftBot } from "../lib/minecraft-api";
import { canManageMinecraftBot } from "../utils/can-manage-minecraft-bot";
import { BOT_DELETE_MODAL_ID, BOT_FIELDS } from "../utils/forms";

/** A music bot leaves the server, goes offline, loses its voice-channel permissions, and its token is deleted. */
async function deleteMusic(interaction: ModalSubmitInteraction, botId: string): Promise<void> {
    const guild = interaction.guild!;
    const record = await removeMusicBot(guild.id, botId);
    if (!record) return void await interaction.editReply({ content: "That music bot is already gone." });

    const channel = guild.channels.cache.get(record.voiceChannelId);
    if (channel && "permissionOverwrites" in channel) {
        await channel.permissionOverwrites.delete(botId, "Music bot removed").catch(() => null);
    }

    Logger.info(`Music bot ${record.name} (${botId}) removed from ${guild.id} by ${interaction.user.id}`, "bots");
    await interaction.editReply({ content: `**${record.name}** was deleted: it left the server and its token was deleted.` });
}

async function deleteMinecraft(interaction: ModalSubmitInteraction): Promise<void> {
    if (!(await canManageMinecraftBot(interaction.user.id))) {
        return void await interaction.editReply({ content: "Only the bot owner and super users can delete the Minecraft bot." });
    }

    const response = await deleteMinecraftBot();
    if (!response.ok) return void await interaction.editReply({ content: response.problem });

    const { removed } = response.data;
    if (!removed) return void await interaction.editReply({ content: "There was no Minecraft bot to delete." });

    Logger.info(`Minecraft bot ${removed.username} (${removed.botId}) deleted by ${interaction.user.id}`, "bots");
    await interaction.editReply({ content: `⛏️ **${removed.username}** was deleted: it's offline and its saved token is gone.` });
}

/** `/bot delete` submitted. */
export const botDeleteModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: BOT_DELETE_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const target = interaction.fields.getStringSelectValues(BOT_FIELDS.target)[0] ?? "";
        if (target === "minecraft") return void await deleteMinecraft(interaction);
        if (target.startsWith("music:")) return void await deleteMusic(interaction, target.slice("music:".length));
        await interaction.editReply({ content: "Pick which bot to delete." });
    },
};
