import { Schema, model, type Document } from "mongoose";
import type { LogKey } from "@shared/config/log-registry";

export interface ILogConfig extends Document {
    key: LogKey;
    serverId: string;
    channelId: string;
    setBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const logConfigSchema = new Schema<ILogConfig>(
    {
        key: { type: String, required: true, unique: true },
        serverId: { type: String, required: true },
        channelId: { type: String, required: true },
        setBy: { type: String, required: true },
    },
    { timestamps: true }
);

export const LogConfig = model<ILogConfig>("LogConfig", logConfigSchema);
