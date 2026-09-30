import { MessageFlags } from "discord.js";
import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { boostFeature } from "./boost";
import { channel } from "./commands/channel";

export default buildFeatureCommands(boostFeature, {
    boost: async (interaction: CommandInteractionLike, client: BotClient) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (interaction.options.getSubcommand() === "channel") await channel(interaction, client);
    },
}) satisfies CommandConfig[];
