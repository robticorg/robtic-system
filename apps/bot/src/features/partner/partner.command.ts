import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike, FeatureSubcommandHandler } from "@typings/feature";
import type { BotClient } from "@core/bot-client";
import { buildFeatureCommands } from "@core/features";
import { partnerFeature } from "./partner";
import { add } from "./commands/add";
import { list } from "./commands/list";
import { remove, partnerAutocomplete } from "./commands/remove";
import { edit } from "./commands/edit";
import { update } from "./commands/update";
import { channel } from "./commands/channel";
import { role } from "./commands/role";

/** `add` and `edit` show a modal, so they must answer first — every subcommand defers (or not) for itself. */
const handlers: Record<string, FeatureSubcommandHandler> = { add, edit, update, list, remove, role, channel };

export default buildFeatureCommands(partnerFeature, {
    partner: {
        run: async (interaction: CommandInteractionLike, client: BotClient) => {
            if (!interaction.guild) return;
            const handler = handlers[interaction.options.getSubcommand()];
            if (handler) await handler(interaction, client);
        },
        autocomplete: partnerAutocomplete,
    },
}) satisfies CommandConfig[];
