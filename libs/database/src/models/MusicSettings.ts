import { Schema, model, type Document } from "mongoose";

/**
 * A server's music settings (RobTic Music dashboard → General). The panel's look is kept here too, but the dashboard
 * builds and posts the panel message itself; the bot only answers its buttons.
 *
 * Every field is optional in the database: what a server hasn't set reads as the defaults in
 * MusicSettingsRepository, which is exactly how music behaved before this collection existed.
 */
export const MUSIC_WORD_KEYS = ["play", "stop", "skip", "pause", "resume", "volume"] as const;
export type MusicWordKey = (typeof MUSIC_WORD_KEYS)[number];
export type MusicWords = Record<MusicWordKey, string[]>;

export interface IMusicSettings extends Document {
    guildId: string;
    /** Text commands typed in a voice channel's chat (`ش song`, `stop`…). */
    commands?: boolean;
    /** The control panel's buttons. */
    panel?: boolean;
    /** Fixed bots stay in their channel 24/7. Off: they join when music starts and leave when it ends. */
    stay?: boolean;
    words?: Partial<MusicWords>;
    /** The posted panel, and how it looks (written by the dashboard). */
    panelLook?: Record<string, unknown>;
    panelChannelId?: string | null;
    panelMessageId?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const musicSettingsSchema = new Schema<IMusicSettings>(
    {
        guildId: { type: String, required: true, unique: true },
        commands: { type: Boolean },
        panel: { type: Boolean },
        stay: { type: Boolean },
        words: { type: Schema.Types.Mixed, default: undefined },
        panelLook: { type: Schema.Types.Mixed, default: undefined },
        panelChannelId: { type: String, default: null },
        panelMessageId: { type: String, default: null },
    },
    { timestamps: true, collection: "musicsettings", minimize: false },
);

export const MusicSettings = model<IMusicSettings>("MusicSettings", musicSettingsSchema);
