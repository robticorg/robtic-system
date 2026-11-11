import { Schema, model, type Document } from "mongoose";

/** Per-guild, per-command access grant (role or StaffTier category) — an additional way in, on top of the command's normal permission check. */
export interface ICommandAccess extends Document {
    guildId: string;
    commandName: string;
    allowedRoleIds: string[];
    allowedCategoryKeys: string[];
    /** Only in these channels (empty = anywhere). Set from the dashboard's Command access page. */
    channelIds: string[];
    /** Must be used in the server's commands channel (ServerConfig.commandsChannelId). */
    commandsChannelOnly: boolean;
    /** Turned off in this server from the dashboard: the bot ignores it. */
    disabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const commandAccessSchema = new Schema<ICommandAccess>(
    {
        guildId: { type: String, required: true, index: true },
        commandName: { type: String, required: true },
        allowedRoleIds: { type: [String], default: [] },
        allowedCategoryKeys: { type: [String], default: [] },
        channelIds: { type: [String], default: [] },
        commandsChannelOnly: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
    },
    { timestamps: true }
);

commandAccessSchema.index({ guildId: 1, commandName: 1 }, { unique: true });

export const CommandAccess = model<ICommandAccess>("CommandAccess", commandAccessSchema);
