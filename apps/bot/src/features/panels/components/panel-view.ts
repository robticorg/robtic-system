import type { ButtonInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { panelButtonHandler } from "../functions/actions";

export const panelViewHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^panel_view_.+$/,

    async run(interaction: ButtonInteraction) {
        await panelButtonHandler(interaction);
    },
};
