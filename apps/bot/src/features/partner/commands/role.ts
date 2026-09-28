import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";
import { partnerRoleProblem } from "../utils/partner-role";

/**
 * `/partner role` — the role every partner representative gets. Refuses a role the bot couldn't
 * actually give. Existing representatives keep whatever role they already have; the new one is
 * given from the next `/partner add` (or when a representative joins).
 */
export const role: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const picked = interaction.options.getRole("role", true);
    const resolved = interaction.guild!.roles.cache.get(picked.id);
    if (!resolved) {
        await interaction.editReply({ content: "I can't find that role." });
        return;
    }

    const problem = partnerRoleProblem(resolved);
    if (problem) {
        await interaction.editReply({ content: problem });
        return;
    }

    await ServerConfigRepository.setPartnerRole(interaction.guildId!, resolved.id);
    await interaction.editReply({ content: `Partner representatives will get ${resolved}.`, allowedMentions: { parse: [] } });
};
