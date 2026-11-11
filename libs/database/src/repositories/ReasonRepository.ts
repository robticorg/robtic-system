import { Reason, type IReason } from "@database/models/Reason";

/** A server's reasons: its own, plus the shared ones it hasn't replaced with its own reason of the same key. */
function merge(rows: IReason[], guildId: string): IReason[] {
    const own = new Set(rows.filter(r => r.guildId === guildId).map(r => r.key));
    return rows.filter(r => r.guildId === guildId || !own.has(r.key));
}

export class ReasonRepository {
    static async create(data: Partial<IReason> & { guildId: string }): Promise<IReason> {
        return Reason.create(data);
    }

    /** The server's own reason with that key, otherwise the shared one. */
    static async findByKey(key: string, guildId: string): Promise<IReason | null> {
        return (await Reason.findOne({ key, guildId })) ?? Reason.findOne({ key, guildId: null });
    }

    /** Only the server's own reason (not a shared one), e.g. to check a key is free before creating. */
    static async findOwn(key: string, guildId: string): Promise<IReason | null> {
        return Reason.findOne({ key, guildId });
    }

    static async findByType(type: IReason["type"], guildId: string): Promise<IReason[]> {
        return merge(await Reason.find({ type, guildId: { $in: [guildId, null] } }).sort({ createdAt: -1 }), guildId);
    }

    static async getAll(guildId: string): Promise<IReason[]> {
        return merge(await Reason.find({ guildId: { $in: [guildId, null] } }).sort({ type: 1, createdAt: -1 }), guildId);
    }

    static async getAllKeys(guildId: string): Promise<string[]> {
        return (await ReasonRepository.getAll(guildId)).map(r => r.key);
    }

    /** Deletes the server's own reason. Shared reasons are left alone: other servers use them too. */
    static async delete(key: string, guildId: string): Promise<IReason | null> {
        return Reason.findOneAndDelete({ key, guildId });
    }

    static async isShared(key: string): Promise<boolean> {
        return (await Reason.exists({ key, guildId: null })) !== null;
    }
}
