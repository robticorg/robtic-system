import {
    FileUploadBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { PARTNER_CONFIG } from "@constants";
import { resolvePartnerChannel } from "../utils/partner-channel";

export const PARTNER_ADD_MODAL_ID = "partner:add";

export const PARTNER_FIELDS = {
    invite: "partner-invite",
    name: "partner-name",
    representative: "partner-representative",
    description: "partner-description",
    image: "partner-image",
} as const;

const text = (id: string, label: string, style: TextInputStyle, maxLength: number, placeholder: string) =>
    new LabelBuilder().setLabel(label).setTextInputComponent(
        new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(true).setMaxLength(maxLength).setPlaceholder(placeholder),
    );

/** `/partner add` — the partner channel must work before anyone fills in a form for it. */
export const add: FeatureSubcommandHandler = async (interaction, _client) => {
    const resolved = await resolvePartnerChannel(interaction.guild!);
    if ("problem" in resolved) {
        await interaction.reply({ content: resolved.problem, flags: MessageFlags.Ephemeral });
        return;
    }

    const { limits } = PARTNER_CONFIG;
    const modal = new ModalBuilder()
        .setCustomId(PARTNER_ADD_MODAL_ID)
        .setTitle("Add Partner")
        .addLabelComponents(
            text(PARTNER_FIELDS.invite, "Server invite URL", TextInputStyle.Short, limits.inviteUrl, "https://discord.gg/..."),
            text(PARTNER_FIELDS.name, "Server name", TextInputStyle.Short, limits.name, "Their server's name"),
            text(PARTNER_FIELDS.representative, "Representative user ID", TextInputStyle.Short, 25, "The partner's representative"),
            text(PARTNER_FIELDS.description, "Partner message", TextInputStyle.Paragraph, limits.description, "Describe their server"),
            new LabelBuilder()
                .setLabel("Partner image")
                .setDescription("Their server logo — shown on the banner beside ours")
                .setFileUploadComponent(new FileUploadBuilder().setCustomId(PARTNER_FIELDS.image).setRequired(true).setMinValues(1).setMaxValues(1)),
        );

    await interaction.showModal(modal);
};
