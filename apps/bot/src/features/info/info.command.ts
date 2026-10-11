import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike, FeatureSubcommandHandler } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { infoFeature } from "./info";
import { create, infoAutocomplete, optionAdd, optionRemove, remove, update } from "./commands/handlers";

/** `create`, `update` and `add` show a modal, so they must answer first — every subcommand defers (or not) for itself. */
const dispatch = (handlers: Record<string, FeatureSubcommandHandler>) =>
    async (interaction: CommandInteractionLike, client: BotClient) => {
        if (!interaction.guild) return;
        const handler = handlers[interaction.options.getSubcommand()];
        if (handler) await handler(interaction, client);
    };

export default buildFeatureCommands(infoFeature, {
    info: { run: dispatch({ create, update, delete: remove }), autocomplete: infoAutocomplete },
    option: { run: dispatch({ add: optionAdd, remove: optionRemove }), autocomplete: infoAutocomplete },
}) satisfies CommandConfig[];
