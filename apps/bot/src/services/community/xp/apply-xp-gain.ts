import type { Guild } from "discord.js";
import { ActivityRepository, ActivityLogRepository, PeriodicStatRepository } from "@database/repositories";
import type { IActivityXP } from "@database/models";
import { calculateLevel, type XpKind } from "@core/xp";
import { publishMetric } from "@core/metrics";
import { Logger } from "@logger";
import { announceLevelUp } from "./announce-level-up";
import { grantLevelRewards } from "./grant-level-rewards";

export interface XpGainResult {
    xp: number;
    leveledUp: boolean;
    newLevel: number;
}

/**
 * Everything that happens *after* XP lands on the record, shared by chat and voice.
 *
 * Message and voice are separate levels: `kind` says which one this XP raised, and only that level
 * can level up, be announced, and unlock roles. The combined `level` (from `totalXP`) is still kept
 * current for the combined leaderboard, silently.
 */
export async function applyXpGain(
    kind: XpKind,
    discordId: string,
    guildId: string,
    username: string,
    guild: Guild,
    xp: number,
    previous: Pick<IActivityXP, "level" | "messageLevel" | "voiceLevel">,
    updated: IActivityXP,
    ctx: string,
): Promise<XpGainResult> {
    await PeriodicStatRepository.incrementAllPeriods(guildId, "xp", discordId, xp);

    publishMetric({ guildId, discordId, username, metric: "xp", value: xp });

    const levelField = kind === "message" ? "messageLevel" : "voiceLevel";
    const previousLevel = previous[levelField] ?? 0;
    const newLevel = calculateLevel(kind === "message" ? updated.messageXP : updated.voiceXP);
    const leveledUp = newLevel > previousLevel;
    const combinedLevel = calculateLevel(updated.totalXP);

    if (leveledUp || combinedLevel !== previous.level) {
        await ActivityRepository.setLevels(discordId, guildId, {
            level: combinedLevel,
            ...(leveledUp ? { [levelField]: newLevel } : {}),
        });
    }

    if (leveledUp) {
        publishMetric({ guildId, discordId, username, metric: "levelUp", value: newLevel - previousLevel });

        Logger.debug(`${username} ${kind} level up: ${previousLevel} → ${newLevel} (${kind} XP: ${kind === "message" ? updated.messageXP : updated.voiceXP})`, ctx);

        await ActivityLogRepository.log({
            guildId,
            userId: discordId,
            type: "level_up",
            amount: newLevel,
            details: `${kind === "message" ? "Message" : "Voice"} level ${previousLevel} → ${newLevel}`,
        });

        const levels = {
            messageLevel: kind === "message" ? newLevel : previous.messageLevel ?? 0,
            voiceLevel: kind === "voice" ? newLevel : previous.voiceLevel ?? 0,
        };
        await grantLevelRewards(discordId, guildId, levels, guild);
        await announceLevelUp(guild, discordId, kind, newLevel);
    }

    await ActivityLogRepository.log({ guildId, userId: discordId, type: "xp_gain", amount: xp });

    return { xp, leveledUp, newLevel };
}
