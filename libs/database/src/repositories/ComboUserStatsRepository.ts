import { ComboUserStats, type IComboUserStats, type IComboPartnerTally } from "@database/models/ComboUserStats";
import { COMBO_CONFIG } from "@core/config";
import { favoritePartnerWeight } from "@core/utils";

export interface ComboEndDelta {
    score: number;
    durationMs: number;
    messages: number;
    streakCurrent: number;
}

export class ComboUserStatsRepository {
    static async get(guildId: string, discordId: string): Promise<IComboUserStats | null> {
        return ComboUserStats.findOne({ guildId, discordId });
    }

    static async getOrCreate(guildId: string, discordId: string): Promise<IComboUserStats> {
        let stats = await ComboUserStats.findOne({ guildId, discordId });
        if (!stats) stats = await ComboUserStats.create({ guildId, discordId });
        return stats;
    }

    /** All per-user aggregate stats for a guild — used to blend all-time bestComboScore into the Champion role sync. */
    static async getAllForGuild(guildId: string): Promise<IComboUserStats[]> {
        return ComboUserStats.find({ guildId });
    }

    /** Applies one ended conversation's totals to both participants' aggregate stats, including the favorite-partner tally. */
    static async applyComboEnd(guildId: string, userAId: string, userBId: string, delta: ComboEndDelta): Promise<void> {
        for (const [userId, partnerId] of [[userAId, userBId], [userBId, userAId]] as const) {
            const stats = await ComboUserStatsRepository.getOrCreate(guildId, userId);

            stats.totalConversations += 1;
            stats.totalMessages += delta.messages;
            stats.totalDurationMs += delta.durationMs;
            stats.totalScoreSum += delta.score;
            stats.longestConversationMs = Math.max(stats.longestConversationMs, delta.durationMs);
            stats.bestStreakEver = Math.max(stats.bestStreakEver, delta.streakCurrent);

            if (delta.score > stats.bestComboScore) {
                stats.bestComboScore = delta.score;
                stats.bestComboPartnerId = partnerId;
            }

            let tally: IComboPartnerTally | undefined = stats.partners.find(p => p.partnerId === partnerId);
            if (!tally) {
                stats.distinctPartners += 1;
                stats.partners.push({ partnerId, score: 0, durationMs: 0, conversations: 0 });
                tally = stats.partners[stats.partners.length - 1];
            }
            tally.score += delta.score;
            tally.durationMs += delta.durationMs;
            tally.conversations += 1;

            stats.partners.sort((a, b) => favoritePartnerWeight(b) - favoritePartnerWeight(a));
            if (stats.partners.length > COMBO_CONFIG.maxTrackedPartners) {
                stats.partners.splice(COMBO_CONFIG.maxTrackedPartners);
            }

            await stats.save();
        }
    }
}
