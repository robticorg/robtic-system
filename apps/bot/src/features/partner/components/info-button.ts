import { MessageFlags, type ButtonInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { PartnerServerRepository } from "@database/repositories";
import { buildPartnerInfo, PARTNER_INFO_ID } from "../utils/partner-views";

/** The Information button under a partner banner — anyone may press it; the answer is only theirs. */
export const partnerInfoHandler: ComponentHandler<ButtonInteraction> = {
    customId: PARTNER_INFO_ID,

    async run(interaction: ButtonInteraction) {
        const partnerId = interaction.customId.split(":")[2]!;
        const partner = await PartnerServerRepository.get(interaction.guildId!, partnerId);

        if (!partner) {
            await interaction.reply({ content: "This partner is no longer listed.", flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.reply({
            ...buildPartnerInfo(partner),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
        });
    },
};
