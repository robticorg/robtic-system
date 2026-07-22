import { Collection } from "discord.js";

/** In-memory cooldown timestamps, keyed by `command:scope` then user id. */
export const cooldowns = new Collection<string, Collection<string, number>>();

export function scopeKey(commandName: string, scopeId: string): string {
    return `${commandName}:${scopeId}`;
}
