import {
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type Invite,
    type ModalSubmitInteraction,
} from "discord.js";
import { PARTNER_CONFIG } from "@constants";
import type { IPartnerServer } from "@database/models";
import { Logger } from "@logger";
import { normalizePartnerImage } from "./render-partner-banner";

/**
 * The partner form, shared by `/partner add` (empty, image required) and `/partner edit`
 * (prefilled, image optional — leave it empty to keep the current logo).
 */

export const PARTNER_ADD_MODAL_ID = "partner:add";
export const PARTNER_EDIT_MODAL_ID = /^partner:edit:[a-f0-9]{24}$/;

export const PARTNER_FIELDS = {
    invite: "partner-invite",
    name: "partner-name",
    representative: "partner-representative",
    description: "partner-description",
    image: "partner-image",
} as const;

const SNOWFLAKE = /^\d{15,25}$/;

function text(id: string, label: string, style: TextInputStyle, maxLength: number, placeholder: string, value?: string) {
    const input = new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(true).setMaxLength(maxLength).setPlaceholder(placeholder);
    if (value) input.setValue(value.slice(0, maxLength));
    return new LabelBuilder().setLabel(label).setTextInputComponent(input);
}

/** The add form, or — given a partner — the edit form with its current values filled in. */
export function buildPartnerModal(partner?: IPartnerServer): ModalBuilder {
    const { limits } = PARTNER_CONFIG;
    const editing = Boolean(partner);

    return new ModalBuilder()
        .setCustomId(partner ? `partner:edit:${String(partner._id)}` : PARTNER_ADD_MODAL_ID)
        .setTitle(editing ? "Edit Partner" : "Add Partner")
        .addLabelComponents(
            text(PARTNER_FIELDS.invite, "Server invite URL", TextInputStyle.Short, limits.inviteUrl, "https://discord.gg/...", partner?.inviteUrl),
            text(PARTNER_FIELDS.name, "Server name", TextInputStyle.Short, limits.name, "Their server's name", partner?.name),
            text(PARTNER_FIELDS.representative, "Representative user ID", TextInputStyle.Short, 25, "The partner's representative", partner?.representativeId),
            text(PARTNER_FIELDS.description, "Partner message", TextInputStyle.Paragraph, limits.description, "Describe their server", partner?.description),
            new LabelBuilder()
                .setLabel(editing ? "New partner image (optional)" : "Partner image")
                .setDescription(editing ? "Leave empty to keep the current logo" : "Their server logo — shown on the banner beside ours")
                .setFileUploadComponent(new FileUploadBuilder()
                    .setCustomId(PARTNER_FIELDS.image)
                    .setRequired(!editing)
                    .setMinValues(editing ? 0 : 1)
                    .setMaxValues(1)),
        );
}

export interface PartnerFormValues {
    invite: Invite;
    name: string;
    representativeId: string;
    description: string;
    /** Normalized PNG, or `null` when editing and no new image was uploaded. */
    image: Buffer | null;
}

/** Validates a submitted form. Either the values, or a message saying what's wrong. */
export async function readPartnerForm(
    interaction: ModalSubmitInteraction,
    { imageRequired }: { imageRequired: boolean },
): Promise<{ values: PartnerFormValues } | { problem: string }> {
    const inviteInput = interaction.fields.getTextInputValue(PARTNER_FIELDS.invite).trim();
    const name = interaction.fields.getTextInputValue(PARTNER_FIELDS.name).trim();
    const representativeId = interaction.fields.getTextInputValue(PARTNER_FIELDS.representative).trim();
    const description = interaction.fields.getTextInputValue(PARTNER_FIELDS.description).trim();
    const upload = interaction.fields.getUploadedFiles(PARTNER_FIELDS.image, imageRequired)?.first();

    // The invite must actually resolve — a typo or an expired link would be a dead post.
    const invite = await interaction.client.fetchInvite(inviteInput).catch(() => null);
    if (!invite) return { problem: "That invite link is invalid or has expired." };

    if (!SNOWFLAKE.test(representativeId)) return { problem: "The representative must be a user ID (numbers only)." };
    const representative = await interaction.client.users.fetch(representativeId).catch(() => null);
    if (!representative) return { problem: "No Discord user has that ID." };

    if (!upload) {
        if (imageRequired) return { problem: "Attach the partner's image." };
        return { values: { invite, name, representativeId, description, image: null } };
    }

    if (!upload.contentType?.startsWith("image/")) return { problem: "The partner image must be an image file (PNG, JPG, WEBP, GIF)." };
    if (upload.size > PARTNER_CONFIG.maxUploadBytes) return { problem: "That image is too large — 8 MB at most." };

    try {
        const response = await fetch(upload.url);
        if (!response.ok) throw new Error(`download failed (${response.status})`);
        const image = await normalizePartnerImage(Buffer.from(await response.arrayBuffer()));
        return { values: { invite, name, representativeId, description, image } };
    } catch (err) {
        Logger.warn(`Partner image could not be processed: ${err}`, "partner");
        return { problem: "I couldn't read that image. Try a PNG or JPG." };
    }
}

/** A warning line for an invite that will stop working, or "" for a permanent one. */
export function inviteExpiryNote(invite: Invite): string {
    return invite.expiresAt
        ? `\n⚠️ This invite expires <t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R> — ask them for a permanent one.`
        : "";
}
