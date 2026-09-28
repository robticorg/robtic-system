import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";
import { partnerChannelProblem } from "../utils/partner-channel";

/** `/partner channel` — refuses a channel the bot couldn't actually post a banner in. */
export const channel: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const picked = interaction.options.getChannel("channel", true);
    const resolved = interaction.guild!.channels.cache.get(picked.id);
    if (!resolved?.isTextBased() || resolved.isDMBased()) {
        await interaction.editReply({ content: "Pick a text channel." });
        return;
    }

    const problem = partnerChannelProblem(resolved);
    if (problem) {
        await interaction.editReply({ content: problem });
        return;
    }

    await ServerConfigRepository.setPartnerChannel(interaction.guildId!, resolved.id);
    await interaction.editReply({ content: `Partner banners will be posted in <#${resolved.id}>.` });
};
