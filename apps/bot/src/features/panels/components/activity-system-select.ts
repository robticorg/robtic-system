import { AttachmentBuilder, ContainerBuilder, MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { getLineImage } from "@core/assets";
import { ACTIVITY_OPTIONS } from "../definitions/activity-system";

export const activitySystemSelectHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: "activity_system_select",

    async run(interaction: StringSelectMenuInteraction) {
        const value = interaction.values[0];
        const option = ACTIVITY_OPTIONS.find(o => o.value === value);

        if (!option) {
            await interaction.reply({ content: "This option is no longer available.", flags: MessageFlags.Ephemeral });
            return;
        }

        const line = await getLineImage().catch(() => null);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(td => td.setContent(`## ${option.emoji ? `${option.emoji} ` : ""}${option.label}`))
            .addTextDisplayComponents(td => td.setContent(option.content));
        if (line) container.addMediaGalleryComponents(mg => mg.addItems(item => item.setURL(`attachment://${line.name}`)));

        await interaction.reply({
            components: [container],
            files: line ? [new AttachmentBuilder(line.data, { name: line.name })] : [],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
        });
    },
};
