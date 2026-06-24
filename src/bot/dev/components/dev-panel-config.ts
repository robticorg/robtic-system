import { MessageFlags, type ButtonInteraction } from "discord.js";

export const devPanelConfig = {
    customId: /^dev_panel_config:.+$/,
    async run(interaction: ButtonInteraction) {
            await interaction.deferUpdate();
            // ...
            interaction.reply({
                content:"Soon ...",
                flags: MessageFlags.Ephemeral
            })
    }
}