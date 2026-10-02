import { ActivityRepository, LevelRewardRepository, PeriodicStatRepository } from "@database/repositories";
import { Logger } from "@logger";
import { calculateLevel } from "./calculate-level";
import { splitExistingXp } from "./level-split";

const BATCH = 500;

/**
 * One-time move from one combined level to separate message and voice levels. Safe to run on every
 * startup: it only touches rows that were never split, and does nothing once all are.
 *
 * - `ActivityXP`: voice XP = the member's recorded all-time voice XP (`PeriodicStat`), message XP
 *   = the rest of `totalXP`. `totalXP` itself is left as it is.
 * - `LevelReward`: every old single-level role becomes a message-level role.
 * - Decay clocks: members without the separate message/voice clocks get both set to their last
 *   known activity.
 *
 * Runs before the bot logs in, so no XP is being granted while it works.
 */
export async function migrateLevelSplit(): Promise<void> {
    const rewards = await LevelRewardRepository.migrateSingleLevel();
    if (rewards.converted || rewards.duplicatesRemoved) {
        Logger.info(`Level rewards: ${rewards.converted} converted to message-level roles, ${rewards.duplicatesRemoved} duplicate role entries removed`, "migration");
    }

    const clocks = await ActivityRepository.backfillDecayClocks();
    if (clocks) Logger.info(`Started separate message/voice decay clocks for ${clocks} members`, "migration");

    let rows = await ActivityRepository.findUnsplit(BATCH);
    if (!rows.length) return;

    const voiceXp = await PeriodicStatRepository.getAllTimeValues("voiceXp");
    let migrated = 0;

    while (rows.length) {
        await ActivityRepository.applySplit(rows.map(row => {
            const split = splitExistingXp(row.totalXP ?? 0, voiceXp.get(`${row.guildId}:${row.discordId}`) ?? 0);
            return {
                id: row._id,
                ...split,
                messageLevel: calculateLevel(split.messageXP),
                voiceLevel: calculateLevel(split.voiceXP),
            };
        }));
        migrated += rows.length;
        rows = await ActivityRepository.findUnsplit(BATCH);
    }

    Logger.info(`Split ${migrated} member XP records into separate message and voice levels`, "migration");
}
