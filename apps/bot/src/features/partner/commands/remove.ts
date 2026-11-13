import { MessageFlags, type AutocompleteInteraction } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { PartnerServerRepository } from "@database/repositories";
import { revokePartnerRole } from "../utils/partner-role";

import { L } from "@utils";
/** `/partner remove` — deletes the partner, takes its banner post down, and the partner role back. */
export const remove: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const partner = await PartnerServerRepository.delete(interaction.guildId!, interaction.options.getString("partner", true));
    if (!partner) {
        await interaction.editReply({ content: L("No such partner: pick one from the list.", "ما في شريك بهذا الاسم: اختر من القائمة.") });
        return;
    }

    let postNote = "";
    if (partner.channelId && partner.messageId) {
        const channel = await interaction.guild!.channels.fetch(partner.channelId).catch(() => null);
        const deleted = channel?.isTextBased()
            ? await channel.messages.delete(partner.messageId).then(() => true, () => false)
            : false;
        if (!deleted) postNote = L(" Its post couldn't be deleted: remove it by hand if it's still there.", " ما قدرت أحذف منشوره: احذفه يدوي إذا باقي.");
    }

    const roleResult = await revokePartnerRole(interaction.guild!, partner.representativeId);
    const roleNote =
        roleResult === "removed" ? L(` <@${partner.representativeId}> lost the partner role.`, ` <@${partner.representativeId}> انسحبت منه رتبة الشراكة.`)
        : roleResult === "kept" ? L(` <@${partner.representativeId}> keeps the partner role: they still represent another partner.`, ` <@${partner.representativeId}> باقي برتبة الشراكة: يمثل شريك ثاني.`)
        : roleResult === "failed" ? L(` ⚠️ I couldn't take the partner role from <@${partner.representativeId}>.`, ` ⚠️ ما قدرت أسحب رتبة الشراكة من <@${partner.representativeId}>.`)
        : "";

    await interaction.editReply({ content: L(`**${partner.name}** is no longer a partner.${postNote}${roleNote}`, `**${partner.name}** ما عاد شريك.${postNote}${roleNote}`), allowedMentions: { parse: [] } });
};

/** Suggests this guild's partners by name (`/partner remove` and `edit`); the value sent back is the partner's id. */
export async function partnerAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const matches = await PartnerServerRepository.search(interaction.guildId!, interaction.options.getFocused(), 25);
    await interaction.respond(matches.map(m => ({ name: m.name.slice(0, 100), value: m.id })));
}
