import { ComboServerRecords, type IComboRecordEntry, type IComboServerRecords } from "@database/models/ComboServerRecords";

export type ComboRecordField = "highestComboEver" | "longestConversation" | "mostMessages" | "highestHeat" | "longestConversationStreak";

export class ComboServerRecordsRepository {
    static async getOrCreate(guildId: string): Promise<IComboServerRecords> {
        let doc = await ComboServerRecords.findOne({ guildId });
        if (!doc) doc = await ComboServerRecords.create({ guildId });
        return doc;
    }

    static async save(doc: IComboServerRecords): Promise<void> {
        await doc.save();
    }

    /**
     * Sets a record only if `entry` beats the stored one — decided by MongoDB, not by a cached
     * copy, so two processes (Gateway scheduler, worker) can never overwrite a higher record with a
     * lower one. Returns whether it was a new record.
     */
    static async raise(guildId: string, field: ComboRecordField, entry: IComboRecordEntry): Promise<boolean> {
        const result = await ComboServerRecords.updateOne(
            { guildId, $or: [{ [field]: null }, { [`${field}.value`]: { $lt: entry.value } }] },
            { $set: { [field]: entry } },
        );
        return result.modifiedCount > 0;
    }
}
