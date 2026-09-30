import { PermissionFlagsBits } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";

/** `/boost channel [channel]` — sets where boosts are thanked; no channel turns it off. */
export const channel: FeatureSubcommandHandler = async (interaction, _client) => {
    const picked = interaction.options.getChannel("channel");
    if (!picked) {
        await ServerConfigRepository.setBoostChannel(interaction.guildId!, null);
        await interaction.editReply({ content: "Boost thank-you messages are off." });
        return;
    }

    const resolved = interaction.guild!.channels.cache.get(picked.id);
    const me = interaction.guild!.members.me;
    const perms = resolved && me ? resolved.permissionsFor(me) : null;
    if (!resolved?.isSendable() || !perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        await interaction.editReply({ content: `I need **View Channel** and **Send Messages** in <#${picked.id}>.` });
        return;
    }

    await ServerConfigRepository.setBoostChannel(interaction.guildId!, resolved.id);
    await interaction.editReply({ content: `Every boost will be thanked in <#${resolved.id}>.` });
};
