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

import { L } from "@utils";
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
        .setTitle(editing ? L("Edit partner", "تعديل شريك") : L("Add partner", "إضافة شريك"))
        .addLabelComponents(
            text(PARTNER_FIELDS.invite, L("Server invite URL", "رابط دعوة السيرفر"), TextInputStyle.Short, limits.inviteUrl, "https://discord.gg/...", partner?.inviteUrl),
            text(PARTNER_FIELDS.name, L("Server name", "اسم السيرفر"), TextInputStyle.Short, limits.name, L("Their server's name", "اسم سيرفرهم"), partner?.name),
            text(PARTNER_FIELDS.representative, L("Representative user ID", "آيدي الممثل"), TextInputStyle.Short, 25, L("The partner's representative", "ممثل الشريك"), partner?.representativeId),
            text(PARTNER_FIELDS.description, L("Partner message", "رسالة الشراكة"), TextInputStyle.Paragraph, limits.description, L("Describe their server", "وصف سيرفرهم"), partner?.description),
            new LabelBuilder()
                .setLabel(editing ? L("New partner image (optional)", "صورة الشريك الجديدة (اختياري)") : L("Partner image", "صورة الشريك"))
                .setDescription(editing ? L("Leave empty to keep the current logo", "اتركها فاضية للإبقاء على الحالية") : L("Their server logo, shown on the banner beside ours", "شعار سيرفرهم، يظهر على البنر جنب شعارنا"))
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
    if (!invite) return { problem: L("That invite link is invalid or has expired.", "رابط الدعوة غير صحيح أو منتهي.") };

    if (!SNOWFLAKE.test(representativeId)) return { problem: L("The representative must be a user ID (numbers only).", "الممثل لازم يكون آيدي (أرقام فقط).") };
    const representative = await interaction.client.users.fetch(representativeId).catch(() => null);
    if (!representative) return { problem: L("No Discord user has that ID.", "ما في حساب ديسكورد بهذا الآيدي.") };

    if (!upload) {
        if (imageRequired) return { problem: L("Attach the partner's image.", "أرفق صورة الشريك.") };
        return { values: { invite, name, representativeId, description, image: null } };
    }

    if (!upload.contentType?.startsWith("image/")) return { problem: L("The partner image must be an image file (PNG, JPG, WEBP, GIF).", "صورة الشريك لازم تكون صورة (PNG أو JPG أو WEBP أو GIF).") };
    if (upload.size > PARTNER_CONFIG.maxUploadBytes) return { problem: L("That image is too large: 8 MB at most.", "الصورة كبيرة: الحد 8 ميقا.") };

    try {
        const response = await fetch(upload.url);
        if (!response.ok) throw new Error(`download failed (${response.status})`);
        const image = await normalizePartnerImage(Buffer.from(await response.arrayBuffer()));
        return { values: { invite, name, representativeId, description, image } };
    } catch (err) {
        Logger.warn(`Partner image could not be processed: ${err}`, "partner");
        return { problem: L("I couldn't read that image. Try a PNG or JPG.", "ما قدرت أقرأ الصورة. جرب PNG أو JPG.") };
    }
}

/** A warning line for an invite that will stop working, or "" for a permanent one. */
export function inviteExpiryNote(invite: Invite): string {
    return invite.expiresAt
        ? L(`\n⚠️ This invite expires <t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>: ask them for a permanent one.`, `\n⚠️ هذي الدعوة تنتهي <t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>: اطلب منهم دعوة دائمة.`)
        : "";
}
