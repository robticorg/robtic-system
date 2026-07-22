import { cooldowns, scopeKey } from "./cooldown-store";

/** Rolls back a cooldown that was set for an attempt that ultimately failed (e.g. the command threw), so the failed attempt isn't charged against the user. */
export function clearCooldown(userId: string, commandName: string, scopeId = "dm"): void {
    cooldowns.get(scopeKey(commandName, scopeId))?.delete(userId);
}
