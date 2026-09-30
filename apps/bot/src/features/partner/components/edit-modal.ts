import { MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { PartnerServerRepository } from "@database/repositories";
import { inviteExpiryNote, PARTNER_EDIT_MODAL_ID, readPartnerForm } from "../utils/partner-form";
import { syncPartnerPost } from "../utils/partner-post";
import { grantPartnerRole, revokePartnerRole } from "../utils/partner-role";
import { ROLE_NOTE } from "../utils/role-note";

const SYNC_NOTE = {
    edited: "Its post was updated.",
    posted: "Its old post was gone, so it was posted again.",
    failed: "⚠️ Its post couldn't be updated — check the partner channel and my permissions, then run `/partner update`.",
} as const;

/**
 * `/partner edit` submitted: store the new details (the logo only if a new one was uploaded), move
 * the partner role if the representative changed, then redraw the post.
 */
export const partnerEditModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: PARTNER_EDIT_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interaction.guild!;
        const partnerId = interaction.customId.split(":")[2]!;

        const before = await PartnerServerRepository.get(guild.id, partnerId);
        if (!before) return void await interaction.editReply({ content: "This partner no longer exists." });

        const form = await readPartnerForm(interaction, { imageRequired: false });
        if ("problem" in form) return void await interaction.editReply({ content: form.problem });
        const { invite, name, representativeId, description, image } = form.values;

        const partner = await PartnerServerRepository.update(guild.id, partnerId, {
            name,
            inviteUrl: invite.url,
            representativeId,
            description,
            ...(image ? { image } : {}),
        });
        if (!partner) return void await interaction.editReply({ content: "This partner no longer exists." });

        // Updated first, so the old representative's count no longer includes this partner.
        let roleNote = "";
        if (before.representativeId !== representativeId) {
            await revokePartnerRole(guild, before.representativeId);
            roleNote = ROLE_NOTE[await grantPartnerRole(guild, representativeId)](representativeId);
        }

        const sync = await syncPartnerPost(guild, partner);
        await interaction.editReply({
            content: [`**${name}** was updated. ${SYNC_NOTE[sync]}`, roleNote].filter(Boolean).join("\n") + inviteExpiryNote(invite),
            allowedMentions: { parse: [] },
        });
    },
};
