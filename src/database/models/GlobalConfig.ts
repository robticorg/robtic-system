import { Schema, model, type Document } from "mongoose";

export interface IGlobalConfig extends Document {
    key: string;
    value: string;
    updatedAt: Date;
}

const globalConfigSchema = new Schema<IGlobalConfig>(
    {
        key: { type: String, required: true, unique: true },
        value: { type: String, required: true },
    },
    { timestamps: true }
);

export const GlobalConfig = model<IGlobalConfig>("GlobalConfig", globalConfigSchema);
