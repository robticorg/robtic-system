import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike, FeatureSubcommandHandler } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { musicFeature } from "./music";
import { create } from "./commands/create";
import { list } from "./commands/list";
import { remove, musicBotAutocomplete } from "./commands/remove";

/** `create` shows a modal, so it must answer first — every subcommand defers (or not) for itself. */
const musicHandlers: Record<string, FeatureSubcommandHandler> = { create, list };

export default buildFeatureCommands(musicFeature, {
    music: async (interaction: CommandInteractionLike, client: BotClient) => {
        if (!interaction.guild) return;
        await musicHandlers[interaction.options.getSubcommand()]?.(interaction, client);
    },
    bot: {
        run: async (interaction: CommandInteractionLike, client: BotClient) => {
            if (!interaction.guild) return;
            if (interaction.options.getSubcommand() === "remove") await remove(interaction, client);
        },
        autocomplete: musicBotAutocomplete,
    },
}) satisfies CommandConfig[];
