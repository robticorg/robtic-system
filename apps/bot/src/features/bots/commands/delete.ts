import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { MusicBotRepository } from "@database/repositories";
import { getMinecraftBot } from "../lib/minecraft-api";
import { buildBotDeleteModal, type DeletableBot } from "../utils/forms";
import { canManageMinecraftBot } from "../utils/can-manage-minecraft-bot";

/**
 * `/bot delete` — opens a form listing the bots that exist now: this server's music bots, and the
 * Minecraft bot for whoever may manage it. The modal has to open within Discord's three seconds,
 * so the Minecraft API gets a short timeout and is simply left out of the list if it's slow.
 */
export const remove: FeatureSubcommandHandler = async (interaction, _client) => {
    const guildId = interaction.guildId!;

    const [musicBots, minecraft] = await Promise.all([
        MusicBotRepository.listByGuild(guildId),
        canManageMinecraftBot(interaction.user.id).then(allowed => allowed ? getMinecraftBot() : null),
    ]);

    const bots: DeletableBot[] = musicBots.map(bot => ({
        value: `music:${bot.botId}`,
        label: bot.name,
        description: `Music · ${bot.botId}`,
        emoji: "🎵",
    }));

    if (minecraft?.ok && minecraft.data.configured) {
        bots.push({
            value: "minecraft",
            label: minecraft.data.username ?? "Minecraft bot",
            description: `Minecraft · ${minecraft.data.online ? "online" : "offline"}`,
            emoji: "⛏️",
        });
    }

    if (!bots.length) {
        const unreachable = minecraft && !minecraft.ok ? `\n-# Couldn't check the Minecraft bot: ${minecraft.problem}` : "";
        await interaction.reply({ content: `There are no bots to delete. Add one with \`/bot create\`.${unreachable}`, flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.showModal(buildBotDeleteModal(bots));
};
