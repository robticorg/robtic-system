import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike, FeatureSubcommandHandler } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { botsFeature } from "./bots";
import { create } from "./commands/create";
import { remove } from "./commands/delete";

/** Both subcommands open a modal, so neither defers. */
const botHandlers: Record<string, FeatureSubcommandHandler> = { create, delete: remove };

export default buildFeatureCommands(botsFeature, {
    bot: async (interaction: CommandInteractionLike, client: BotClient) => {
        if (!interaction.guild) return;
        await botHandlers[interaction.options.getSubcommand()]?.(interaction, client);
    },
}) satisfies CommandConfig[];
