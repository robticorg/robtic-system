import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { PartnerServerRepository } from "@database/repositories";
import { buildPartnerList } from "../utils/partner-views";

export const list: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

    const partners = await PartnerServerRepository.list(interaction.guildId!);
    await interaction.editReply({ ...buildPartnerList(interaction.guild!.name, partners), allowedMentions: { parse: [] } });
};
