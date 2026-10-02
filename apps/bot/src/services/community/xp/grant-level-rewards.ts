import type { Guild } from "discord.js";
import { qualifiesForLevelReward, type MemberLevels } from "@core/xp";
import { LevelRewardRepository } from "@database/repositories/LevelRewardRepository";
import { ActivityLogRepository } from "@database/repositories/ActivityLogRepository";
import { Logger } from "@logger";

const CTX = "community:xp";

function describe(req: { messageLevel: number | null; voiceLevel: number | null }): string {
    return [req.messageLevel ? `message level ${req.messageLevel}` : "", req.voiceLevel ? `voice level ${req.voiceLevel}` : ""]
        .filter(Boolean).join(" + ");
}

/** Gives every level-reward role whose requirements the member now meets (message, voice, or both). Never removes. */
export async function grantLevelRewards(
    discordId: string,
    guildId: string,
    levels: MemberLevels,
    guild: Guild
): Promise<void> {
    const rewards = (await LevelRewardRepository.getAll(guildId)).filter(r => qualifiesForLevelReward(r, levels));
    Logger.debug(`Level rewards for message ${levels.messageLevel} / voice ${levels.voiceLevel}: ${rewards.length} qualified`, CTX);
    if (rewards.length === 0) return;

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
        Logger.debug(`Could not fetch member ${discordId} for reward grant`, CTX);
        return;
    }

    for (const reward of rewards) {
        if (!member.roles.cache.has(reward.roleId)) {
            Logger.debug(`Granting reward role ${reward.roleId} (${describe(reward)}) to ${discordId}`, CTX);
            await member.roles.add(reward.roleId).catch(() => null);
            await ActivityLogRepository.log({
                guildId,
                userId: discordId,
                type: "reward_granted",
                amount: reward.messageLevel ?? reward.voiceLevel ?? 0,
                details: `Granted role ${reward.roleId} for reaching ${describe(reward)}`,
            });
        }
    }
}
