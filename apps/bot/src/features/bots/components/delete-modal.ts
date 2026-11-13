import { MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { removeMusicBot } from "@core/music";
import { Logger } from "@logger";
import { deleteMinecraftBot } from "../lib/minecraft-api";
import { canManageMinecraftBot } from "../utils/can-manage-minecraft-bot";
import { BOT_DELETE_MODAL_ID, BOT_FIELDS } from "../utils/forms";

import { L } from "@utils";
/** A music bot leaves the server, goes offline, loses its voice-channel permissions, and its token is deleted. */
async function deleteMusic(interaction: ModalSubmitInteraction, botId: string): Promise<void> {
    const guild = interaction.guild!;
    const record = await removeMusicBot(guild.id, botId);
    if (!record) return void await interaction.editReply({ content: L("That music bot is already gone.", "بوت الموسيقى هذا محذوف من قبل.") });

    const channel = guild.channels.cache.get(record.voiceChannelId);
    if (channel && "permissionOverwrites" in channel) {
        await channel.permissionOverwrites.delete(botId, "Music bot removed").catch(() => null);
    }

    Logger.info(`Music bot ${record.name} (${botId}) removed from ${guild.id} by ${interaction.user.id}`, "bots");
    await interaction.editReply({ content: L(`**${record.name}** was deleted: it left the server and its token was deleted.`, `تم حذف **${record.name}**: طلع من السيرفر وانحذف التوكن.`) });
}

async function deleteMinecraft(interaction: ModalSubmitInteraction): Promise<void> {
    if (!(await canManageMinecraftBot(interaction.user.id))) {
        return void await interaction.editReply({ content: L("Only the bot owner and super users can delete the Minecraft bot.", "حذف بوت ماينكرافت لمالك البوت والمستخدمين الخارقين فقط.") });
    }

    const response = await deleteMinecraftBot();
    if (!response.ok) return void await interaction.editReply({ content: response.problem });

    const { removed } = response.data;
    if (!removed) return void await interaction.editReply({ content: L("There was no Minecraft bot to delete.", "ما كان في بوت ماينكرافت ينحذف.") });

    Logger.info(`Minecraft bot ${removed.username} (${removed.botId}) deleted by ${interaction.user.id}`, "bots");
    await interaction.editReply({ content: L(`⛏️ **${removed.username}** was deleted: it's offline and its saved token is gone.`, `⛏️ تم حذف **${removed.username}**: صار أوفلاين وانحذف التوكن.`) });
}

/** `/bot delete` submitted. */
export const botDeleteModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: BOT_DELETE_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const target = interaction.fields.getStringSelectValues(BOT_FIELDS.target)[0] ?? "";
        if (target === "minecraft") return void await deleteMinecraft(interaction);
        if (target.startsWith("music:")) return void await deleteMusic(interaction, target.slice("music:".length));
        await interaction.editReply({ content: L("Pick which bot to delete.", "اختر أي بوت تبي تحذف.") });
    },
};
