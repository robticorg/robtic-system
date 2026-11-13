import { PermissionFlagsBits } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";

import { L } from "@utils";
/** `/boost channel [channel]` — sets where boosts are thanked; no channel turns it off. */
export const channel: FeatureSubcommandHandler = async (interaction, _client) => {
    const picked = interaction.options.getChannel("channel");
    if (!picked) {
        await ServerConfigRepository.setBoostChannel(interaction.guildId!, null);
        await interaction.editReply({ content: L("Boost thank-you messages are off.", "رسائل شكر البوست مقفلة.") });
        return;
    }

    const resolved = interaction.guild!.channels.cache.get(picked.id);
    const me = interaction.guild!.members.me;
    const perms = resolved && me ? resolved.permissionsFor(me) : null;
    if (!resolved?.isSendable() || !perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        await interaction.editReply({ content: L(`I need **View Channel** and **Send Messages** in <#${picked.id}>.`, `أحتاج **View Channel** و **Send Messages** في <#${picked.id}>.`) });
        return;
    }

    await ServerConfigRepository.setBoostChannel(interaction.guildId!, resolved.id);
    await interaction.editReply({ content: L(`Every boost will be thanked in <#${resolved.id}>.`, `كل بوست بينشكر في <#${resolved.id}>.`) });
};
