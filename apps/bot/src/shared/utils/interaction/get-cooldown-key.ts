import type { ChatInputCommandInteraction } from "discord.js";
import type { BotClient } from "@core/bot-client";

/** Namespaced by bot name — the cooldown store is a single shared singleton, so e.g. moderation's /mod and modmail's /mod don't share a timer. */
export function getCooldownKey(interaction: ChatInputCommandInteraction, client: BotClient): string {
    const parts = [client.botName, interaction.commandName];
    try {
        const group = interaction.options.getSubcommandGroup(false);
        if (group) parts.push(group);
        const sub = interaction.options.getSubcommand(false);
        if (sub) parts.push(sub);
    } catch {
        // Command has no subcommands defined — fall back to the base command name.
    }
    return parts.join(":");
}
