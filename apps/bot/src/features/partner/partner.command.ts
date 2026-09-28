import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike, FeatureSubcommandHandler } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { partnerFeature } from "./partner";
import { add } from "./commands/add";
import { list } from "./commands/list";
import { remove, removeAutocomplete } from "./commands/remove";
import { channel } from "./commands/channel";
import { role } from "./commands/role";

/** `add` shows a modal, so it must answer first — every subcommand defers (or not) for itself. */
const handlers: Record<string, FeatureSubcommandHandler> = { add, list, remove, role, channel };

export default buildFeatureCommands(partnerFeature, {
    partner: {
        run: async (interaction: CommandInteractionLike, client: BotClient) => {
            if (!interaction.guild) return;
            const handler = handlers[interaction.options.getSubcommand()];
            if (handler) await handler(interaction, client);
        },
        autocomplete: removeAutocomplete,
    },
}) satisfies CommandConfig[];
