import { Schema, model, type Document } from "mongoose";

export type MusicBotMode = "fixed" | "roaming";

/**
 * A music bot added on the Robtic Voice dashboard: a separate bot account the main bot logs in and runs.
 *
 * It belongs to exactly one guild (`guildId`, where it was created) and plays in exactly one voice
 * channel. The token is never stored in plain text — `encryptedToken` is AES-256-GCM
 * (`libs/core/src/music/token-crypto.ts`), keyed by `MUSIC_TOKEN_KEY`, which never touches the
 * database. `botId` is unique, so the same bot account can't be registered twice anywhere.
 */
export interface IMusicBot extends Document {
    guildId: string;
    /** The bot account's user id (also its application id for bots created in the portal). */
    botId: string;
    applicationId: string;
    name: string;
    /**
     * `fixed`: lives in `voiceChannelId` and only plays there. `roaming`: no channel of its own; it joins whichever
     * voice channel someone asks for music in, when that channel has no fixed bot (RobTic Music dashboard → Bots).
     */
    mode: MusicBotMode;
    /** The fixed bot's channel. Null for a roaming bot. */
    voiceChannelId: string | null;
    encryptedToken: string;
    createdBy: string;
    /** Set by the dashboard's Restart: the bot is logged out and in again on the next sync. */
    restartAt?: Date | null;
    /** Written by the running bot every sync, for the dashboard: when it last checked in, and where it is. */
    lastSeenAt?: Date | null;
    inGuild?: boolean;
    connectedChannelId?: string | null;
    nowPlaying?: string | null;
    /** False when its Message Content intent is off: typed commands can't reach it. */
    readsMessages?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const musicBotSchema = new Schema<IMusicBot>(
    {
        guildId: { type: String, required: true, index: true },
        botId: { type: String, required: true, unique: true },
        applicationId: { type: String, required: true },
        name: { type: String, required: true },
        mode: { type: String, enum: ["fixed", "roaming"], default: "fixed" },
        voiceChannelId: { type: String, default: null },
        encryptedToken: { type: String, required: true },
        createdBy: { type: String, required: true },
        restartAt: { type: Date, default: null },
        lastSeenAt: { type: Date, default: null },
        inGuild: { type: Boolean, default: false },
        connectedChannelId: { type: String, default: null },
        nowPlaying: { type: String, default: null },
        readsMessages: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const MusicBot = model<IMusicBot>("MusicBot", musicBotSchema);
