import { RoleSelectMenuInteraction } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { SubmissionTypeRepository } from "@database/repositories";
import { buildConfigPanel } from "../utils/configPanel";

export default {
    customId: /^submit-config-(grant-roles|manager-roles)_/,

    async run(interaction: RoleSelectMenuInteraction, client: BotClient) {
        const [, action, key] = interaction.customId.match(/^submit-config-(grant-roles|manager-roles)_(.+)$/) ?? [];
        const guildId = interaction.guildId!;
        const roleIds = interaction.values;

        const updated = action === "grant-roles"
            ? await SubmissionTypeRepository.setGrantRoles(guildId, key, roleIds)
            : await SubmissionTypeRepository.setManagerRoles(guildId, key, roleIds);

        if (!updated) return;

        await interaction.update(buildConfigPanel(updated));
    },
};
