import { LogConfig, type ILogConfig } from "@database/models/LogConfig";
import type { LogKey } from "@constants";

export class LogConfigRepository {
    /** The shared row for a key (what /setup-log manages). */
    static async findByKey(key: LogKey): Promise<ILogConfig | null> {
        return LogConfig.findOne({ key, guildId: null });
    }

    /** Where a server's `key` logs go: its own row if it set one, otherwise the shared row. */
    static async findFor(key: LogKey, guildId: string | null | undefined): Promise<ILogConfig | null> {
        if (guildId) {
            const own = await LogConfig.findOne({ key, guildId });
            if (own) return own;
        }
        return LogConfigRepository.findByKey(key);
    }

    /** Writes the shared row (guildId omitted) or one server's own row. */
    static async upsert(key: LogKey, serverId: string, channelId: string, setBy: string, guildId: string | null = null): Promise<ILogConfig> {
        return LogConfig.findOneAndUpdate(
            { key, guildId },
            { key, guildId, serverId, channelId, setBy },
            { upsert: true, returnDocument: "after" }
        ) as Promise<ILogConfig>;
    }

    /** Stops a server logging `key` to its own channel (it falls back to the shared row again). */
    static async clearFor(key: LogKey, guildId: string): Promise<void> {
        await LogConfig.deleteOne({ key, guildId });
    }
}
