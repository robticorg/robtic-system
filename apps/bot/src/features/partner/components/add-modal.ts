import { MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { PartnerServerRepository } from "@database/repositories";
import { Logger } from "@logger";
import { resolvePartnerChannel } from "../utils/partner-channel";
import { inviteExpiryNote, PARTNER_ADD_MODAL_ID, readPartnerForm } from "../utils/partner-form";
import { renderPartnerPost } from "../utils/partner-post";
import { grantPartnerRole } from "../utils/partner-role";
import { ROLE_NOTE } from "../utils/role-note";

/**
 * `/partner add` submitted: validate everything first, then render, post, and only then keep —
 * so a failed post never leaves a partner behind that nobody can see.
 */
export const partnerAddModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: PARTNER_ADD_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const fail = (content: string) => interaction.editReply({ content });
        const guild = interaction.guild!;

        const form = await readPartnerForm(interaction, { imageRequired: true });
        if ("problem" in form) return fail(form.problem);
        const { invite, name, representativeId, description, image } = form.values;

        const resolved = await resolvePartnerChannel(guild);
        if ("problem" in resolved) return fail(resolved.problem);

        const partner = await PartnerServerRepository.create({
            guildId: guild.id,
            name,
            inviteUrl: invite.url,
            representativeId,
            description,
            image: image!,
            addedBy: interaction.user.id,
        });

        try {
            const message = await resolved.channel.send(await renderPartnerPost(partner));
            await PartnerServerRepository.setPost(String(partner._id), message.channelId, message.id);

            const roleNote = ROLE_NOTE[await grantPartnerRole(guild, representativeId)](representativeId);
            await interaction.editReply({
                content: `**${name}** is now a partner — posted in <#${message.channelId}>.\n${roleNote}${inviteExpiryNote(invite)}`,
                allowedMentions: { parse: [] },
            });
        } catch (err) {
            await PartnerServerRepository.delete(guild.id, String(partner._id));
            Logger.warn(`Partner post failed in ${guild.id}: ${err}`, "partner");
            await fail("I couldn't post in the partner channel, so the partner wasn't added. Check my permissions there.");
        }
    },
};
