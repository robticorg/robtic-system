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

    if (timestamps.has(userId)) {
        const expiresAt = timestamps.get(userId)! + cooldownMs;
        if (now < expiresAt) return true;
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownMs);
    return false;
}

export function getRemainingCooldown(userId: string, commandName: string, cooldownMs: number, scopeId = "dm"): number {
    const timestamps = cooldowns.get(scopeKey(commandName, scopeId));
    if (!timestamps?.has(userId)) return 0;

    const expiresAt = timestamps.get(userId)! + cooldownMs;
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
