import { MessageFlags } from "discord.js";
import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { invitesFeature } from "./invites";
import { invites } from "./commands/invites";
import { info } from "./commands/info";
import { configChannel } from "./commands/config-channel";

export default buildFeatureCommands(invitesFeature, {
    invites,
    info,

    "invites-config": async (interaction: CommandInteractionLike, client: BotClient) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (interaction.options.getSubcommand() === "channel") await configChannel(interaction, client);
    },
}) satisfies CommandConfig[];
