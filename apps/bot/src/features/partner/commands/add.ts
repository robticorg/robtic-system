import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { resolvePartnerChannel } from "../utils/partner-channel";
import { buildPartnerModal } from "../utils/partner-form";

/** `/partner add` — the partner channel must work before anyone fills in a form for it. */
export const add: FeatureSubcommandHandler = async (interaction, _client) => {
    const resolved = await resolvePartnerChannel(interaction.guild!);
    if ("problem" in resolved) {
        await interaction.reply({ content: resolved.problem, flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.showModal(buildPartnerModal());
};
