import { Schema, model, type Document } from "mongoose";

/**
 * A music bot created with `/music create`: a separate bot account the main bot logs in and runs.
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
    voiceChannelId: string;
    encryptedToken: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const musicBotSchema = new Schema<IMusicBot>(
    {
        guildId: { type: String, required: true, index: true },
        botId: { type: String, required: true, unique: true },
        applicationId: { type: String, required: true },
        name: { type: String, required: true },
        voiceChannelId: { type: String, required: true },
        encryptedToken: { type: String, required: true },
        createdBy: { type: String, required: true },
    },
    { timestamps: true }
);

export const MusicBot = model<IMusicBot>("MusicBot", musicBotSchema);
