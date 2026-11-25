import { Reason, type IReason } from "@database/models/Reason";

/**
 * A server's punishment reasons: only the ones it made (dashboard or /reason). The old shared defaults (guildId null)
 * are no longer handed to every server the bot joins.
 */
export class ReasonRepository {
    static async create(data: Partial<IReason> & { guildId: string }): Promise<IReason> {
        return Reason.create(data);
    }

    static async findByKey(key: string, guildId: string): Promise<IReason | null> {
        return Reason.findOne({ key, guildId });
    }

    /** Same as findByKey; kept for callers that check a key is free before creating. */
    static async findOwn(key: string, guildId: string): Promise<IReason | null> {
        return Reason.findOne({ key, guildId });
    }

    static async findByType(type: IReason["type"], guildId: string): Promise<IReason[]> {
        return Reason.find({ type, guildId }).sort({ createdAt: -1 });
    }

    static async getAll(guildId: string): Promise<IReason[]> {
        return Reason.find({ guildId }).sort({ type: 1, createdAt: -1 });
    }

    static async getAllKeys(guildId: string): Promise<string[]> {
        return (await ReasonRepository.getAll(guildId)).map(r => r.key);
    }

    static async delete(key: string, guildId: string): Promise<IReason | null> {
        return Reason.findOneAndDelete({ key, guildId });
    }
}
