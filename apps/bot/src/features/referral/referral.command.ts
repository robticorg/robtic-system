import { MessageFlags } from "discord.js";
import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike, FeatureSubcommandHandler } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { referralFeature } from "./referral";
import { info, use } from "./commands/member";
import { create, edit, list, remove, reset } from "./commands/config";

const memberHandlers: Record<string, FeatureSubcommandHandler> = { use, info };
const configHandlers: Record<string, FeatureSubcommandHandler> = { create, edit, delete: remove, list, reset };

export default buildFeatureCommands(referralFeature, {
    referral: async (interaction: CommandInteractionLike, client: BotClient) => {
        await memberHandlers[interaction.options.getSubcommand()]?.(interaction, client);
    },

    "referral-config": async (interaction: CommandInteractionLike, client: BotClient) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await configHandlers[interaction.options.getSubcommand()]?.(interaction, client);
    },
}) satisfies CommandConfig[];
