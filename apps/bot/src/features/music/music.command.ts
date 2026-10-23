import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike, FeatureSubcommandHandler } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { musicFeature } from "./music";
import { list } from "./commands/list";

const musicHandlers: Record<string, FeatureSubcommandHandler> = { list };

export default buildFeatureCommands(musicFeature, {
    music: async (interaction: CommandInteractionLike, client: BotClient) => {
        if (!interaction.guild) return;
        await musicHandlers[interaction.options.getSubcommand()]?.(interaction, client);
    },
}) satisfies CommandConfig[];
