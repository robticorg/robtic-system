import { MessageFlags, type ChatInputCommandInteraction, type Interaction } from "discord.js";
import type { CommandConfig } from "@typings/command";
import type { BotClient } from "@core/bot-client";
import { DEFAULT_COMMAND_COOLDOWN_SECONDS, INTERACTION_MESSAGES } from "@constants";
import { isOnCooldown, getRemainingCooldown, errorEmbed } from "@utils";
import { getCooldownKey } from "./get-cooldown-key";
import { scheduleDeletion } from "./schedule-deletion";

export const cooldowns = async (intract: Interaction, command: CommandConfig, client: BotClient): Promise<boolean> => {
    let interaction = intract as ChatInputCommandInteraction;

    const cooldownMs = (command.cooldown ?? DEFAULT_COMMAND_COOLDOWN_SECONDS) * 1000;
    const scopeId = interaction.guildId ?? "dm";
    const cooldownKey = getCooldownKey(interaction, client);
    if (isOnCooldown(interaction.user.id, cooldownKey, cooldownMs, scopeId)) {
        const remaining = getRemainingCooldown(interaction.user.id, cooldownKey, cooldownMs, scopeId);
        await interaction.reply({
            embeds: [errorEmbed(INTERACTION_MESSAGES.cooldownWait(remaining))],
            flags: MessageFlags.Ephemeral,
        });
        scheduleDeletion(() => interaction.deleteReply());
        return false;
    }
    return true;
};
