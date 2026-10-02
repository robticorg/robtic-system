import type { Client, Guild } from "discord.js";
import { ActivityRepository } from "@database/repositories/ActivityRepository";
import { ActivityLogRepository } from "@database/repositories/ActivityLogRepository";
import { XPSettingsRepository } from "@database/repositories/XPSettingsRepository";
import { DECAY_CONFIG } from "@constants";
import { decayLossForKind } from "@core/xp";
import { Logger } from "@logger";
import { calculateLevel, removeLevelRewards } from "../xp";
import { logToChannel, decayEmbed } from "../../../utils/community/activity-log";

const pct = (bp: number) => `${bp / 100}%`;

/**
 * XP decay for one guild. Message XP and voice XP decay independently, each from its own clock
 * (last real message / last active voice minute): idle in voice but chatting loses only voice XP.
 * Each kind loses a percentage of its own current XP, at most once a day (`decayLossForKind`).
 * Both levels are recalculated, and any level-reward role the member no longer qualifies for is
 * removed.
 */
export async function processGuildDecay(client: Client, guild: Guild): Promise<void> {
    const settings = await XPSettingsRepository.get(guild.id);
    if (!settings?.decayEnabled) return;

    const now = new Date();
    const threshold = new Date(now.getTime() - DECAY_CONFIG.inactiveDaysThreshold * 86_400_000);
    const candidates = await ActivityRepository.getInactiveUsers(guild.id, threshold);

    for (const user of candidates) {
        const message = decayLossForKind(user.messageXP ?? 0, user.decay.messageActiveAt ?? user.decay.lastActiveAt, user.decay.messageDecayedAt ?? null, now);
        const voice = decayLossForKind(user.voiceXP ?? 0, user.decay.voiceActiveAt ?? user.decay.lastActiveAt, user.decay.voiceDecayedAt ?? null, now);
        const loss = { messageLoss: message.loss, voiceLoss: voice.loss };
        const actualLoss = loss.messageLoss + loss.voiceLoss;
        if (actualLoss <= 0) continue;

        const levels = {
            level: calculateLevel(user.totalXP - actualLoss),
            messageLevel: calculateLevel((user.messageXP ?? 0) - loss.messageLoss),
            voiceLevel: calculateLevel((user.voiceXP ?? 0) - loss.voiceLoss),
        };
        const before = { messageLevel: user.messageLevel ?? 0, voiceLevel: user.voiceLevel ?? 0 };
        const levelDown = levels.messageLevel < before.messageLevel || levels.voiceLevel < before.voiceLevel;

        await ActivityRepository.applyDecay(user.discordId, guild.id, loss, levels, now);

        const parts = [
            loss.messageLoss > 0 ? `${loss.messageLoss} message XP (${pct(message.rateBp)})` : "",
            loss.voiceLoss > 0 ? `${loss.voiceLoss} voice XP (${pct(voice.rateBp)})` : "",
        ].filter(Boolean).join(" and ");

        await ActivityLogRepository.log({
            guildId: guild.id,
            userId: user.discordId,
            type: "xp_decay",
            amount: -actualLoss,
            details: `Inactive — lost ${parts}`,
        });

        if (levelDown) {
            await ActivityLogRepository.log({
                guildId: guild.id,
                userId: user.discordId,
                type: "level_down",
                amount: levels.messageLevel,
                details: `Decayed: message ${before.messageLevel} → ${levels.messageLevel}, voice ${before.voiceLevel} → ${levels.voiceLevel}`,
            });

            await removeLevelRewards(user.discordId, guild.id, levels, guild);
        }

        Logger.debug(`Decay: ${user.username} lost ${parts}`, "community");

        await logToChannel(client, "decay", decayEmbed(user.discordId, loss, levelDown, before, levels));
    }
}
