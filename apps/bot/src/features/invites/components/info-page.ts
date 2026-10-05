import type { ButtonInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { verifyInvoker } from "@bot/utils/interaction";
import { buildInfoView, INFO_PAGE_ID } from "../utils/info-view";
import { orInvitesUnavailable } from "../utils/service-errors";

/** Prev/Next under `/info`. Only whoever opened the panel can turn its pages. */
export const invitesInfoPageHandler: ComponentHandler<ButtonInteraction> = {
    customId: INFO_PAGE_ID,

    async run(interaction: ButtonInteraction) {
        const [, , invokerId, targetId, page] = interaction.customId.split(":");
        if (!(await verifyInvoker(interaction, invokerId!))) return;

        await interaction.deferUpdate();
        const target = await interaction.client.users.fetch(targetId!);
        await interaction.editReply(await orInvitesUnavailable(() => buildInfoView(interaction.guildId!, invokerId!, target, Number(page))));
    },
};
