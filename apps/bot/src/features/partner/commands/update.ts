import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { PartnerServerRepository } from "@database/repositories";
import { syncPartnerPost, type PartnerPostSync } from "../utils/partner-post";

/**
 * `/partner update` — re-renders every partner's post from the current code: the banner template,
 * the layout, the buttons. Posts are edited in place; one that was deleted is posted again in the
 * partner channel. One at a time, to stay well inside Discord's rate limits.
 */
export const update: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const partners = await PartnerServerRepository.listWithImages(interaction.guildId!);
    if (!partners.length) {
        await interaction.editReply({ content: "There are no partners to update." });
        return;
    }

    const results: Record<PartnerPostSync, string[]> = { edited: [], posted: [], failed: [] };
    for (const partner of partners) {
        results[await syncPartnerPost(interaction.guild!, partner)].push(partner.name);
    }

    const lines = [`Updated **${results.edited.length}** of ${partners.length} partner posts.`];
    if (results.posted.length) lines.push(`Posted again (the old post was gone): ${results.posted.join(", ")}`);
    if (results.failed.length) lines.push(`⚠️ Couldn't update: ${results.failed.join(", ")} — check the partner channel and my permissions there.`);

    await interaction.editReply({ content: lines.join("\n").slice(0, 2000), allowedMentions: { parse: [] } });
};
