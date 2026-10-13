import { MessageFlags } from "discord.js";
import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { tagFeature } from "./tag";
import { setup } from "./commands/setup";

export default buildFeatureCommands(tagFeature, {
    tag: async (interaction: CommandInteractionLike, client: BotClient) => {
        if (!interaction.guild) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (interaction.options.getSubcommand() === "setup") await setup(interaction, client);
    },
}) satisfies CommandConfig[];
