import { ComboHistory, type IComboHistory } from "@database/models/ComboHistory";

export interface ComboHistoryInput {
    guildId: string;
    userAId: string;
    userBId: string;
    score: number;
    level: string;
    durationMs: number;
    messages: number;
    endedAt: Date;
}

export class ComboHistoryRepository {
    static async create(input: ComboHistoryInput): Promise<IComboHistory> {
        return ComboHistory.create({
            ...input,
            participants: [input.userAId, input.userBId],
        });
    }

    static async findForUser(guildId: string, userId: string, limit: number): Promise<IComboHistory[]> {
        return ComboHistory.find({ guildId, participants: userId })
            .sort({ endedAt: -1 })
            .limit(limit);
    }
}
