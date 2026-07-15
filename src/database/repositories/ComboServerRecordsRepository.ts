import { ComboServerRecords, type IComboServerRecords } from "@database/models/ComboServerRecords";

export class ComboServerRecordsRepository {
    static async getOrCreate(guildId: string): Promise<IComboServerRecords> {
        let doc = await ComboServerRecords.findOne({ guildId });
        if (!doc) doc = await ComboServerRecords.create({ guildId });
        return doc;
    }

    static async save(doc: IComboServerRecords): Promise<void> {
        await doc.save();
    }
}
