import { XP_CONFIG } from "@constants";

/** Whether this member earned XP too recently to earn again. */
export function isOnXPCooldown(lastGrant: Date): boolean {
    return Date.now() - lastGrant.getTime() < XP_CONFIG.cooldownMs;
}
