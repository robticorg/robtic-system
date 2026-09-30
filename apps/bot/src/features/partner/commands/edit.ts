import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { PartnerServerRepository } from "@database/repositories";
import { buildPartnerModal } from "../utils/partner-form";

/** `/partner edit partner:` — the add form, prefilled; submitting it updates the partner and its post. */
export const edit: FeatureSubcommandHandler = async (interaction, _client) => {
    const partner = await PartnerServerRepository.get(interaction.guildId!, interaction.options.getString("partner", true));
    if (!partner) {
        await interaction.reply({ content: "No such partner — pick one from the list.", flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.showModal(buildPartnerModal(partner));
};
