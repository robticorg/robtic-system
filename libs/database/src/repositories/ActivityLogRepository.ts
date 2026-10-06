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

    /** Logs once per `key` — a retried job writing the same entry again is a no-op. */
    static async logOnce(key: string, data: {
        guildId: string;
        userId: string;
        type: ActivityLogType;
        amount: number;
        details?: string;
    }): Promise<boolean> {
        try {
            await ActivityLog.create({ ...data, key });
            return true;
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return false;
            throw err;
        }
    }

    static async getByUser(userId: string, guildId: string, limit = 50): Promise<IActivityLog[]> {
        return ActivityLog.find({ userId, guildId })
            .sort({ createdAt: -1 })
            .limit(limit);
    }
}
