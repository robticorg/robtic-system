import {
    Events,
    type Interaction,
} from "discord.js";
import type { BotClient } from "@core/BotClient.ts";
import { Logger } from "@core/libs";
import { checkPermissions, commandError, cooldowns, releaseCooldown, HandlingComponent } from "../utils/interaction-helper";

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction, client: BotClient) {
        const handledComponent = await HandlingComponent(interaction, client);
        if (handledComponent) return;

        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) {
                try {
                    await command.autocomplete(interaction, client);
                } catch (error) {
                    Logger.warn(`Autocomplete error for "${interaction.commandName}": ${error}`, client.botName);
                }
            }
            return;
        }

        if (!interaction.isCommand()) return;

        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            Logger.warn(`Command "${interaction.commandName}" not found`, client.botName);
            return;
        }

        try {
            const hasPerms = await checkPermissions(interaction, command);
            if (!hasPerms) return;

            const canProceed = await cooldowns(interaction, command, client);
            if (!canProceed) return;

            try {
                await command.run(interaction, client);
            } catch (error) {
                // The command didn't actually complete (e.g. threw before/while replying,
                // interaction expired) — don't charge the cooldown for a no-op attempt.
                releaseCooldown(interaction, client);
                throw error;
            }
        } catch (error) {
            await commandError(error, interaction, client);
        }
    },
};
