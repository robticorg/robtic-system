import { MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { PARTNER_CONFIG } from "@constants";
import { PartnerServerRepository } from "@database/repositories";
import { Logger } from "@logger";
import { PARTNER_ADD_MODAL_ID, PARTNER_FIELDS } from "../commands/add";
import { resolvePartnerChannel } from "../utils/partner-channel";
import { normalizePartnerImage, renderPartnerBanner } from "../utils/render-partner-banner";
import { buildPartnerPost } from "../utils/partner-views";
import { grantPartnerRole, type PartnerRoleResult } from "../utils/partner-role";

const SNOWFLAKE = /^\d{15,25}$/;

const ROLE_NOTE: Record<PartnerRoleResult, (userId: string) => string> = {
    granted: id => `<@${id}> got the partner role.`,
    removed: () => "",
    kept: () => "",
    "not-member": id => `<@${id}> isn't in the server yet — they'll get the partner role when they join.`,
    "no-role": () => "No partner role is set, so no role was given. Set one with `/partner role`.",
    failed: id => `⚠️ I couldn't give <@${id}> the partner role — check that it's below my highest role.`,
};

/**
 * `/partner add` submitted: validate everything first, then render, post, and only then store —
 * so a failed post never leaves a partner behind that nobody can see.
 */
export const partnerAddModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: PARTNER_ADD_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const fail = (content: string) => interaction.editReply({ content });
        const guild = interaction.guild!;

        const inviteInput = interaction.fields.getTextInputValue(PARTNER_FIELDS.invite).trim();
        const name = interaction.fields.getTextInputValue(PARTNER_FIELDS.name).trim();
        const representativeId = interaction.fields.getTextInputValue(PARTNER_FIELDS.representative).trim();
        const description = interaction.fields.getTextInputValue(PARTNER_FIELDS.description).trim();
        const upload = interaction.fields.getUploadedFiles(PARTNER_FIELDS.image, true).first();

        // The invite must actually resolve — a typo or an expired link would be a dead post.
        const invite = await interaction.client.fetchInvite(inviteInput).catch(() => null);
        if (!invite) return fail("That invite link is invalid or has expired.");

        if (!SNOWFLAKE.test(representativeId)) return fail("The representative must be a user ID (numbers only).");
        const representative = await interaction.client.users.fetch(representativeId).catch(() => null);
        if (!representative) return fail("No Discord user has that ID.");

        if (!upload) return fail("Attach the partner's image.");
        if (!upload.contentType?.startsWith("image/")) return fail("The partner image must be an image file (PNG, JPG, WEBP, GIF).");
        if (upload.size > PARTNER_CONFIG.maxUploadBytes) return fail("That image is too large — 8 MB at most.");

        let image: Buffer;
        let banner: Buffer;
        try {
            const response = await fetch(upload.url);
            if (!response.ok) throw new Error(`download failed (${response.status})`);
            image = await normalizePartnerImage(Buffer.from(await response.arrayBuffer()));
            banner = await renderPartnerBanner(image);
        } catch (err) {
            Logger.warn(`Partner image could not be processed: ${err}`, "partner");
            return fail("I couldn't read that image. Try a PNG or JPG.");
        }

        const resolved = await resolvePartnerChannel(guild);
        if ("problem" in resolved) return fail(resolved.problem);

        const partner = await PartnerServerRepository.create({
            guildId: guild.id,
            name,
            inviteUrl: invite.url,
            representativeId,
            description,
            image,
            addedBy: interaction.user.id,
        });

        try {
            const message = await resolved.channel.send({
                ...buildPartnerPost(String(partner._id), name, banner),
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            });
            await PartnerServerRepository.setPost(String(partner._id), message.channelId, message.id);

            const roleNote = ROLE_NOTE[await grantPartnerRole(guild, representativeId)](representativeId);
            const expiry = invite.expiresAt ? `\n⚠️ This invite expires <t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R> — ask them for a permanent one.` : "";
            await interaction.editReply({
                content: `**${name}** is now a partner — posted in <#${message.channelId}>.\n${roleNote}${expiry}`,
                allowedMentions: { parse: [] },
            });
        } catch (err) {
            await PartnerServerRepository.delete(guild.id, String(partner._id));
            Logger.warn(`Partner post failed in ${guild.id}: ${err}`, "partner");
            await fail("I couldn't post in the partner channel, so the partner wasn't added. Check my permissions there.");
        }
    },
};
