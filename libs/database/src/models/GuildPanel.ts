import { Schema, model, type Document } from "mongoose";

/**
 * A panel a server built on the dashboard (Panels page): a Components V2 message or an embed with buttons and menus.
 * The dashboard posts it and keeps it here; the bot answers its buttons and menu options from `definition`.
 * The definition's shape is robtic-discord's `Panel` (libs/shared/src/panels.ts); stored as-is.
 */
export interface IGuildPanel extends Document {
    guildId: string;
    panelId: string;
    definition: Record<string, unknown>;
    channelId: string | null;
    messageId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const guildPanelSchema = new Schema<IGuildPanel>(
    {
        guildId: { type: String, required: true },
        panelId: { type: String, required: true },
        definition: { type: Schema.Types.Mixed, required: true },
        channelId: { type: String, default: null },
        messageId: { type: String, default: null },
    },
    { timestamps: true, minimize: false }
);

guildPanelSchema.index({ guildId: 1, panelId: 1 }, { unique: true });

export const GuildPanel = model<IGuildPanel>("GuildPanel", guildPanelSchema);
