import { ButtonInteraction } from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";
import { parseShortcutButtonCustomId, buildProofModal } from "../utils/punishFlow";

// A real ButtonInteraction (unlike the shortcut message that triggered the DM), so it can showModal().
export default {
    customId: /^punish_shortcut_(warn|mute|ban)_/,

    async run(interaction: ButtonInteraction, _client: BotClient) {
        const parsed = parseShortcutButtonCustomId(interaction.customId);
        if (!parsed) return;

        await interaction.showModal(
            buildProofModal(parsed.type, parsed.guildId, parsed.targetId, parsed.reasonKey, parsed.moderatorId, parsed.extra)
        );
    },
};
