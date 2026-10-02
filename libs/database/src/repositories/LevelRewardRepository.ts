import { LevelReward, type ILevelReward } from "@database/models/LevelReward";

export class LevelRewardRepository {
    /** Sets (or replaces) the levels a role requires. The caller guarantees at least one is given. */
    static async set(guildId: string, roleId: string, messageLevel: number | null, voiceLevel: number | null): Promise<ILevelReward> {
        return LevelReward.findOneAndUpdate(
            { guildId, roleId },
            { $set: { messageLevel, voiceLevel } },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async remove(guildId: string, roleId: string): Promise<boolean> {
        const result = await LevelReward.deleteOne({ guildId, roleId });
        return result.deletedCount > 0;
    }

    /**
     * One-time conversion of pre-split rows (a single `level`) into message-level requirements.
     *
     * The old unique index was `{guildId, level}`; the new one is `{guildId, roleId}`. A role set for
     * several levels keeps only its lowest level (where it was first granted); the other rows are the
     * duplicates the new index cannot hold. Returns how many rows were converted and removed.
     */
    static async migrateSingleLevel(): Promise<{ converted: number; duplicatesRemoved: number }> {
        const collection = LevelReward.collection;
        await collection.dropIndex("guildId_1_level_1").catch(() => null);

        const legacy = await collection.find({ level: { $exists: true } }).sort({ level: 1 }).toArray();
        const kept = new Set<string>();
        const duplicates = [];
        for (const row of legacy) {
            const key = `${row.guildId}:${row.roleId}`;
            if (kept.has(key)) duplicates.push(row._id);
            else kept.add(key);
        }

        if (duplicates.length) await collection.deleteMany({ _id: { $in: duplicates } });
        const result = await collection.updateMany(
            { level: { $exists: true } },
            [{ $set: { messageLevel: "$level", voiceLevel: null } }, { $unset: "level" }],
        );

        await LevelReward.createIndexes();
        return { converted: result.modifiedCount, duplicatesRemoved: duplicates.length };
    }

    /** Every level reward in the guild, easiest first. */
    static async getAll(guildId: string): Promise<ILevelReward[]> {
        const rows = await LevelReward.find({ guildId });
        return rows.sort((a, b) => ((a.messageLevel ?? 0) + (a.voiceLevel ?? 0)) - ((b.messageLevel ?? 0) + (b.voiceLevel ?? 0)));
    }
}
