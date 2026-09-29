import { ActivityLog, type IActivityLog, type ActivityLogType } from "@database/models/ActivityLog";

export class ActivityLogRepository {
    static async log(data: {
        guildId: string;
        userId: string;
        type: ActivityLogType;
        amount: number;
        details?: string;
    }): Promise<IActivityLog> {
        return ActivityLog.create(data);
    }

    static async getByUser(userId: string, guildId: string, limit = 50): Promise<IActivityLog[]> {
        return ActivityLog.find({ userId, guildId })
            .sort({ createdAt: -1 })
            .limit(limit);
    }
}
