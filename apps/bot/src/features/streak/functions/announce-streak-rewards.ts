import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    type Guild,
    type TextChannel,
    type User,
} from "discord.js";
import { StreakRewardRepository, StreakRewardClaimRepository } from "@database/repositories";
import { COLORS } from "@constants";
import { Logger } from "@logger";
import { getLogChannel } from "@bot/utils/server-log";

import { L } from "@utils";
const CTX = "main:streak";

/**
 * Posts a claim button for every reward threshold the member has now reached.
 *
 * `<=` rather than `===` so a streak jumped forward by `/streak-config sync` or `/streak-return`
 * still catches up on thresholds it skipped past; the unique index behind
 * `tryCreateNotification` is what stops that from announcing the same reward twice.
 */
export async function announceStreakRewards(guild: Guild, user: User, guildId: string, currentStreak: number): Promise<void> {
    const rewards = await StreakRewardRepository.list(guildId);
    const eligible = rewards.filter(reward => reward.threshold <= currentStreak);
    if (!eligible.length) return;

    for (const reward of eligible) {
        const created = await StreakRewardClaimRepository.tryCreateNotification(guildId, user.id, reward.threshold);
        if (!created) continue;

        const logChannel = await getLogChannel(guild.client, "rewards_log", guildId) as TextChannel | null;
        if (!logChannel) continue;

        const embed = new EmbedBuilder()
            .setTitle(L("🎁 New streak reward!", "🎁 مكافأة ستريك جديدة!"))
            .setColor(COLORS.activity)
            .setDescription(L(`<@${user.id}> reached a **${reward.threshold}**-day streak! 🔥\nReward: ${reward.offer}`, `<@${user.id}> وصل إلى **${reward.threshold}** يوم ستريك متواصل! 🔥\nالمكافأة: ${reward.offer}`))
            .setTimestamp();

        const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`streak_reward_claim_${user.id}_${reward.threshold}`)
                .setLabel(L("Claim reward", "استلام المكافأة"))
                .setStyle(ButtonStyle.Success)
                .setEmoji("🎁"),
        );

        await logChannel.send({ embeds: [embed], components: [button] }).catch(err =>
            Logger.error(`Failed to post streak reward announcement for ${user.id} (threshold ${reward.threshold}): ${err}`, CTX)
        );
    }
}
