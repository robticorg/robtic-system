import { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, FileUploadBuilder } from "discord.js";
import type { PunishType } from "@typings/punishment";
import { PUNISH_TITLES, PUNISH_PROOF_MESSAGES, PROOF_NOTE_MAX_LENGTH } from "@constants";
import { proofModalCustomId } from "./proof-custom-id";

/** The proof form for a saved request (openProofRequest). It works from a DM too: the request knows its server. */
export function buildProofModal(requestId: string, type: PunishType): ModalBuilder {
    return new ModalBuilder()
        .setCustomId(proofModalCustomId(requestId))
        .setTitle(PUNISH_PROOF_MESSAGES.modalTitle(PUNISH_TITLES[type]).slice(0, 45))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(PUNISH_PROOF_MESSAGES.noteLabel)
                .setDescription(PUNISH_PROOF_MESSAGES.noteDescription)
                .setTextInputComponent(new TextInputBuilder().setCustomId("note").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(PROOF_NOTE_MAX_LENGTH)),
            new LabelBuilder()
                .setLabel(PUNISH_PROOF_MESSAGES.fileLabel)
                .setDescription(PUNISH_PROOF_MESSAGES.fileDescription)
                .setFileUploadComponent(new FileUploadBuilder().setCustomId("proof").setMinValues(1).setMaxValues(1).setRequired(true)),
        );
}
