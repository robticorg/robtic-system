import { Collection } from "discord.js";
import { cooldowns, scopeKey } from "./cooldown-store";

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
