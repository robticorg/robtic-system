import { Schema, model, type Document } from "mongoose";

export interface ISentPanel {
    panelKey: string;
    channelId: string;
    messageId: string;
    guildId: string;
    sentBy: string;
}

export interface IShortcut {
    command: string;
    trigger: string;
}

export interface IServerRoles {
    en?: string;
    ar?: string;
    members?: string;
    bots?: string;
}

export interface IServerConfig extends Document {
    guildId: string;
    sentPanels: ISentPanel[];
    shortcuts: IShortcut[];
    roles: IServerRoles;
    modmailChannelId?: string;
    /** @deprecated legacy single-channel field, replaced by lineChannelIds */
    lineChannelId?: string;
    lineChannelIds: string[];
    /** Prefix for main-bot text commands in this guild (e.g. "!"). Falls back to DEFAULT_PREFIX when unset. */
    prefix?: string;
    createdAt: Date;
    updatedAt: Date;
}

const sentPanelSchema = new Schema<ISentPanel>(
    {
        panelKey: { type: String, required: true },
        channelId: { type: String, required: true },
        messageId: { type: String, required: true },
        guildId: { type: String, required: true },
        sentBy: { type: String, required: true },
    },
    { _id: true }
);

const shortcutSchema = new Schema<IShortcut>({
    command: { type: String, required: true },
    trigger: { type: String, required: true },
}, { _id: false });

const serverConfigSchema = new Schema<IServerConfig>(
    {
        guildId: { type: String, required: true, unique: true },
        sentPanels: { type: [sentPanelSchema], default: [] },
        shortcuts: { type: [shortcutSchema], default: [] },
        roles: {
            type: {
                en: { type: String },
                ar: { type: String },
                members: { type: String },
                bots: { type: String },
            },
            default: {},
        },
        modmailChannelId: { type: String },
        lineChannelId: { type: String }, // legacy single-channel field, kept for migration fallback
        lineChannelIds: { type: [String], default: [] },
        prefix: { type: String },
    },
    { timestamps: true }
);

export const ServerConfig = model<IServerConfig>("ServerConfig", serverConfigSchema);
