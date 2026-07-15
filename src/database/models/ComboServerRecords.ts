import { Schema, model, type Document } from "mongoose";

export interface IComboRecordEntry {
    value: number;
    userAId: string;
    userBId: string;
    achievedAt: Date;
}

export interface IComboServerRecords extends Document {
    guildId: string;
    highestComboEver: IComboRecordEntry | null;
    longestConversation: IComboRecordEntry | null;
    mostMessages: IComboRecordEntry | null;
    highestHeat: IComboRecordEntry | null;
    longestConversationStreak: IComboRecordEntry | null;
    createdAt: Date;
    updatedAt: Date;
}

const recordEntrySchema = new Schema<IComboRecordEntry>(
    {
        value: { type: Number, required: true },
        userAId: { type: String, required: true },
        userBId: { type: String, required: true },
        achievedAt: { type: Date, required: true },
    },
    { _id: false }
);

const comboServerRecordsSchema = new Schema<IComboServerRecords>(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        highestComboEver: { type: recordEntrySchema, default: null },
        longestConversation: { type: recordEntrySchema, default: null },
        mostMessages: { type: recordEntrySchema, default: null },
        highestHeat: { type: recordEntrySchema, default: null },
        longestConversationStreak: { type: recordEntrySchema, default: null },
    },
    { timestamps: true }
);

export const ComboServerRecords = model<IComboServerRecords>("ComboServerRecords", comboServerRecordsSchema);
