import type { ChatInputCommandInteraction, Interaction } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { clearCooldown } from "@utils";
import { getCooldownKey } from "./get-cooldown-key";

/** Rolls back the cooldown charged for this interaction, for use when the command failed to actually run to completion. */
export const releaseCooldown = (intract: Interaction, client: BotClient): void => {
    const interaction = intract as ChatInputCommandInteraction;
    const scopeId = interaction.guildId ?? "dm";
    clearCooldown(interaction.user.id, getCooldownKey(interaction, client), scopeId);
};
