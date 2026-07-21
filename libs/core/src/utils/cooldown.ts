import { Collection } from "discord.js";

const cooldowns = new Collection<string, Collection<string, number>>();

function scopeKey(commandName: string, scopeId: string): string {
    return `${commandName}:${scopeId}`;
}

export function isOnCooldown(userId: string, commandName: string, cooldownMs: number, scopeId = "dm"): boolean {
    const key = scopeKey(commandName, scopeId);
    if (!cooldowns.has(key)) {
        cooldowns.set(key, new Collection());
    }

    const timestamps = cooldowns.get(key)!;
    const now = Date.now();

    const startedAt = timestamps.get(userId);
    if (startedAt !== undefined && now < startedAt + cooldownMs) {
        return true;
    }

    timestamps.set(userId, now);
    return false;
}

/** Rolls back a cooldown that was set for an attempt that ultimately failed (e.g. the command threw), so the failed attempt isn't charged against the user. */
export function clearCooldown(userId: string, commandName: string, scopeId = "dm"): void {
    cooldowns.get(scopeKey(commandName, scopeId))?.delete(userId);
}

export function getRemainingCooldown(userId: string, commandName: string, cooldownMs: number, scopeId = "dm"): number {
    const timestamps = cooldowns.get(scopeKey(commandName, scopeId));
    if (!timestamps?.has(userId)) return 0;

    const expiresAt = timestamps.get(userId)! + cooldownMs;
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
