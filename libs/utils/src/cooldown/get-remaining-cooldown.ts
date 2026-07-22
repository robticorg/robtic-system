import { cooldowns, scopeKey } from "./cooldown-store";

export function getRemainingCooldown(userId: string, commandName: string, cooldownMs: number, scopeId = "dm"): number {
    const timestamps = cooldowns.get(scopeKey(commandName, scopeId));
    if (!timestamps?.has(userId)) return 0;

    const expiresAt = timestamps.get(userId)! + cooldownMs;
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
