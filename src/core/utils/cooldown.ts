import { Collection } from "discord.js";
import { Logger } from "@core/libs";

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
        Logger.debug(
            `[cooldown-debug] BLOCKED key=${key} user=${userId} startedAt=${startedAt} now=${now} elapsedMs=${now - startedAt} cooldownMs=${cooldownMs} pid=${process.pid}`,
            "cooldown"
        );
        return true;
    }

    Logger.debug(
        `[cooldown-debug] SET key=${key} user=${userId} prevStartedAt=${startedAt ?? "none"} now=${now} pid=${process.pid}`,
        "cooldown"
    );
    timestamps.set(userId, now);
    return false;
}

export function getRemainingCooldown(userId: string, commandName: string, cooldownMs: number, scopeId = "dm"): number {
    const timestamps = cooldowns.get(scopeKey(commandName, scopeId));
    if (!timestamps?.has(userId)) return 0;

    const expiresAt = timestamps.get(userId)! + cooldownMs;
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
