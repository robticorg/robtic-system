import { ButtonInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { PunishRequestRepository } from "@database/repositories";
import { L, errorText } from "@utils";
import { parseShortcutButtonCustomId, buildProofModal, openProofRequest } from "../../utils/moderation/punish-flow";

/** "Submit proof" in a moderator's DMs (prefix commands can't open a form): opens the proof form for the request. */
export default {
    customId: /^punish_shortcut(:[a-f0-9]{24}|_(warn|mute|ban)_.+)$/,

    async run(interaction: ButtonInteraction, _client: BotClient) {
        const parsed = parseShortcutButtonCustomId(interaction.customId);
        if (!parsed) return;

        if ("requestId" in parsed) {
            const request = await PunishRequestRepository.get(parsed.requestId);
            if (!request || request.status !== "proof") {
                await interaction.reply({ content: errorText(L("This was already used, or has expired.", "هذا مستخدم من قبل أو انتهت صلاحيته.")), flags: MessageFlags.Ephemeral });
                return;
            }
            await interaction.showModal(buildProofModal(parsed.requestId, request.type));
            return;
        }

        // A button sent before requests were saved: save it now, then open the form.
        const requestId = await openProofRequest(parsed);
        await interaction.showModal(buildProofModal(requestId, parsed.type));
    },
};
