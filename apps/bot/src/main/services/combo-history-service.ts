import type { ICombo, IComboHistory } from "@database/models";
import { ComboHistoryRepository } from "@database/repositories";
import { COMBO_CONFIG } from "@core/config";

export async function recordEndedCombo(pair: ICombo, endedAt: Date): Promise<IComboHistory> {
    return ComboHistoryRepository.create({
        guildId: pair.guildId,
        userAId: pair.userLowId,
        userBId: pair.userHighId,
        score: pair.currentScore,
        level: pair.level,
        durationMs: pair.totalDurationMs,
        messages: pair.messages,
        endedAt,
    });
}

export async function getHistoryForUser(guildId: string, userId: string, limit: number = COMBO_CONFIG.historyPageSize): Promise<IComboHistory[]> {
    return ComboHistoryRepository.findForUser(guildId, userId, limit);
}
