import { StaffLog, type IStaffLog } from "@database/models/StaffLog";
import type { StaffAction } from "@sdk";

export interface StaffLogInput {
    guildId: string;
    action: StaffAction;
    serverId: string;
    actorUuid?: string;
    actorUsername?: string;
    actorDiscordId?: string;
    targetUuid?: string;
    targetUsername?: string;
    targetDiscordId?: string;
    reason?: string;
    duration?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
}

export class StaffLogRepository {
    static async append(input: StaffLogInput): Promise<IStaffLog> {
        return StaffLog.create({
            ...input,
            metadata: input.metadata ?? {},
            occurredAt: input.occurredAt ?? new Date(),
        });
    }
}
