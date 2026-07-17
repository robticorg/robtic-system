import { ContainerBuilder, MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import type { ComponentHandler } from "@core/config";
import { ACTIVITY_OPTIONS } from "../utils/panels/definitions/activity-system";

export const activitySystemSelectHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: "activity_system_select",

    async run(interaction: StringSelectMenuInteraction) {
        const value = interaction.values[0];
        const option = ACTIVITY_OPTIONS.find(o => o.value === value);

        if (!option) {
            await interaction.reply({ content: "This option is no longer available.", flags: MessageFlags.Ephemeral });
            return;
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(td => td.setContent(`## ${option.emoji ? `${option.emoji} ` : ""}${option.label}`))
            .addTextDisplayComponents(td => td.setContent(option.content));

        await interaction.reply({
            components: [container],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
        });
    },
};
