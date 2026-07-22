import { LogConfig, type ILogConfig } from "@database/models/LogConfig";
import type { LogKey } from "@constants";

export class LogConfigRepository {
    static async findByKey(key: LogKey): Promise<ILogConfig | null> {
        return LogConfig.findOne({ key });
    }

    static async findAll(): Promise<ILogConfig[]> {
        return LogConfig.find();
    }

    static async upsert(key: LogKey, serverId: string, channelId: string, setBy: string): Promise<ILogConfig> {
        return LogConfig.findOneAndUpdate(
            { key },
            { key, serverId, channelId, setBy },
            { upsert: true, returnDocument: "after" }
        ) as Promise<ILogConfig>;
    }

    static async deleteByKey(key: LogKey): Promise<void> {
        await LogConfig.deleteOne({ key });
    }
}
