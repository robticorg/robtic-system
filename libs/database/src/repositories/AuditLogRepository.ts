import { AuditLog, type IAuditLog } from "@database/models/AuditLog";

export class AuditLogRepository {
    static async log(data: {
        guildId?: string;
        eventName: string;
        source: string;
        actorId?: string;
        targetId?: string;
        channelId?: string;
        messageId?: string;
        botName?: BotName;
        metadata?: Record<string, unknown>;
    }): Promise<IAuditLog> {
        return AuditLog.create(data);
    }
}
