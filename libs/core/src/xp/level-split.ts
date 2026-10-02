import { calculateLevel } from "./calculate-level";
import { xpForLevel } from "./xp-for-level";

/**
 * Message and voice are two separate levels, each on the same XP curve: message XP only ever
 * raises the message level, voice XP only the voice level. Everything here is pure, so the rules
 * are testable without a database.
 */

export type XpKind = "message" | "voice";

export interface MemberLevels {
    messageLevel: number;
    voiceLevel: number;
}

/** What a level-reward role asks for. `null` = not required; at least one is set. */
export interface LevelRequirement {
    messageLevel: number | null;
    voiceLevel: number | null;
}

/** A level, and how far into the next one `xp` is — what `/level` and `/profile` draw. */
export function levelProgress(xp: number): { level: number; progress: number; needed: number } {
    const safe = Math.max(0, xp);
    const level = calculateLevel(safe);
    const floor = xpForLevel(level);
    return { level, progress: safe - floor, needed: xpForLevel(level + 1) - floor };
}

/** Whether a requirement names any level at all — an entry with neither is never valid. */
export function hasAnyRequirement(req: LevelRequirement): boolean {
    return (req.messageLevel ?? 0) > 0 || (req.voiceLevel ?? 0) > 0;
}

/** True when every level the role requires is met. A requirement naming no level qualifies nobody. */
export function qualifiesForLevelReward(req: LevelRequirement, levels: MemberLevels): boolean {
    if (!hasAnyRequirement(req)) return false;
    // `!(a >= b)` rather than `a < b`: a NaN level must fail, and every comparison with NaN is false.
    if (req.messageLevel && !(levels.messageLevel >= req.messageLevel)) return false;
    if (req.voiceLevel && !(levels.voiceLevel >= req.voiceLevel)) return false;
    return true;
}

/**
 * How hard a role is to earn: its required levels added together. "Message 10 + voice 5" (15) is
 * harder than "message 10" (10). The reward bonus ranks roles by this.
 */
export function levelRequirementSize(req: LevelRequirement): number {
    return Math.max(0, req.messageLevel ?? 0) + Math.max(0, req.voiceLevel ?? 0);
}

/**
 * Splits a pre-split combined total for the one-time migration: voice gets what was actually
 * recorded as voice XP (never more than the total), message gets the rest. Voice XP earned before
 * voice XP was recorded separately cannot be told apart, so it stays with message.
 */
export function splitExistingXp(totalXP: number, recordedVoiceXp: number): { messageXP: number; voiceXP: number } {
    const total = Math.max(0, Math.floor(totalXP));
    const voiceXP = Math.min(total, Math.max(0, Math.floor(recordedVoiceXp)));
    return { messageXP: total - voiceXP, voiceXP };
}
