import type { FeatureSubcommandHandler } from "@typings/feature";
import { buildBotCreateModal } from "../utils/forms";

/** `/bot create` — opens the form (type, token, and for music: name and voice channel). Everything happens on submit. */
export const create: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.showModal(buildBotCreateModal());
};
