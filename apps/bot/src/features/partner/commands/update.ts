import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { PartnerServerRepository } from "@database/repositories";
import { syncPartnerPost, type PartnerPostSync } from "../utils/partner-post";

import { L } from "@utils";
/**
 * `/partner update` — re-renders every partner's post from the current code: the banner template,
 * the layout, the buttons. Posts are edited in place; one that was deleted is posted again in the
 * partner channel. One at a time, to stay well inside Discord's rate limits.
 */
export const update: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const partners = await PartnerServerRepository.listWithImages(interaction.guildId!);
    if (!partners.length) {
        await interaction.editReply({ content: L("There are no partners to update.", "ما في شركاء يتحدثون.") });
        return;
    }

    const results: Record<PartnerPostSync, string[]> = { edited: [], posted: [], failed: [] };
    for (const partner of partners) {
        results[await syncPartnerPost(interaction.guild!, partner)].push(partner.name);
    }

    const lines = [L(`Updated **${results.edited.length}** of ${partners.length} partner posts.`, `تم تحديث **${results.edited.length}** من ${partners.length} منشور شراكة.`)];
    if (results.posted.length) lines.push(L(`Posted again (the old post was gone): ${results.posted.join(", ")}`, `انرسل من جديد (القديم كان محذوف): ${results.posted.join("، ")}`));
    if (results.failed.length) lines.push(L(`⚠️ Couldn't update: ${results.failed.join(", ")}. Check the partner channel and my permissions there.`, `⚠️ ما قدرت أحدث: ${results.failed.join("، ")}. تأكد من روم الشراكات وصلاحياتي.`));

    await interaction.editReply({ content: lines.join("\n").slice(0, 2000), allowedMentions: { parse: [] } });
};
