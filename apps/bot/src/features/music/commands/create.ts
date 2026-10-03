import type { FeatureSubcommandHandler } from "@typings/feature";
import { buildMusicCreateModal } from "../utils/create-form";

/** `/music create` — opens the form (token, name, voice channel). Everything happens on submit. */
export const create: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.showModal(buildMusicCreateModal());
};
