import type { Guild } from "discord.js";
import { qualifiesForLevelReward, type MemberLevels } from "@core/xp";
import { LevelRewardRepository } from "@database/repositories/LevelRewardRepository";
import { ActivityLogRepository } from "@database/repositories/ActivityLogRepository";

/** After decay: takes back every level-reward role whose requirements the member no longer meets. */
export async function removeLevelRewards(
    discordId: string,
    guildId: string,
    levels: MemberLevels,
    guild: Guild
): Promise<void> {
    const allRewards = await LevelRewardRepository.getAll(guildId);
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return;

    for (const reward of allRewards) {
        if (!qualifiesForLevelReward(reward, levels) && member.roles.cache.has(reward.roleId)) {
            await member.roles.remove(reward.roleId).catch(() => null);
            await ActivityLogRepository.log({
                guildId,
                userId: discordId,
                type: "reward_removed",
                amount: reward.messageLevel ?? reward.voiceLevel ?? 0,
                details: `Removed role ${reward.roleId} (now message ${levels.messageLevel} / voice ${levels.voiceLevel})`,
            });
        }
    }
}
