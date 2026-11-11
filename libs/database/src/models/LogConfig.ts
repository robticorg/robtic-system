import { Schema, model, type Document } from "mongoose";
import type { LogKey } from "@constants";

/**
 * Where one kind of log goes.
 *
 * `guildId` is the server whose events the row routes. A row without one is the shared row `/setup-log` writes
 * (one bot-wide destination, usually a central log server), and any server without its own row falls back to it.
 * Rows with a `guildId` are written by the dashboard, so each server can log to its own channels.
 */
export interface ILogConfig extends Document {
    key: LogKey;
    guildId?: string | null;
    /** The server the channel is in (the central log server for shared rows). */
    serverId: string;
    channelId: string;
    setBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const logConfigSchema = new Schema<ILogConfig>(
    {
        key: { type: String, required: true },
        guildId: { type: String, default: null },
        serverId: { type: String, required: true },
        channelId: { type: String, required: true },
        setBy: { type: String, required: true },
    },
    { timestamps: true }
);

// A missing guildId indexes as null, so the old one-row-per-key rule still holds for the shared rows.
logConfigSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const LogConfig = model<ILogConfig>("LogConfig", logConfigSchema);
