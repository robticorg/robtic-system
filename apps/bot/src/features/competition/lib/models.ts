import { Schema, model, type Document } from "mongoose";

/**
 * TEMP (competition bot) — see ../README.md. Three collections, all prefixed `tempcompetition…` so
 * they are easy to find and drop once the competition is over.
 */

/** The competition bot of one server, and the competition's state. One per guild. */
export interface ICompetitionBot extends Document {
    guildId: string;
    botId: string;
    applicationId: string;
    encryptedToken: string;
    createdBy: string;
    /** Voting is open (`!start`) — vote buttons are on every post. */
    started: boolean;
    /** `!end` was used — no buttons anywhere. */
    ended: boolean;
    /** `!hide` — the vote-count button is hidden. */
    hideCounts: boolean;
    /** `!set-room` — where `!register` posts. `null` = the channel the command is used in. */
    roomChannelId: string | null;
    leaderboard: { channelId: string | null; messageId: string | null; refreshedAt: Date | null };
}

const competitionBotSchema = new Schema<ICompetitionBot>(
    {
        guildId: { type: String, required: true, unique: true },
        botId: { type: String, required: true },
        applicationId: { type: String, required: true },
        encryptedToken: { type: String, required: true },
        createdBy: { type: String, required: true },
        started: { type: Boolean, default: false },
        ended: { type: Boolean, default: false },
        hideCounts: { type: Boolean, default: false },
        roomChannelId: { type: String, default: null },
        leaderboard: {
            channelId: { type: String, default: null },
            messageId: { type: String, default: null },
            refreshedAt: { type: Date, default: null },
        },
    },
    { timestamps: true },
);

/** One participant: their post, number and image. */
export interface ICompetitionEntry extends Document {
    guildId: string;
    number: number;
    userId: string;
    channelId: string;
    messageId: string;
    /** The image's file name on the post — referenced as `attachment://<imageName>` on every edit. */
    imageName: string;
    /** `!remove #N` — the post stays, struck through, with no buttons. */
    removed: boolean;
}

const competitionEntrySchema = new Schema<ICompetitionEntry>(
    {
        guildId: { type: String, required: true },
        number: { type: Number, required: true },
        userId: { type: String, required: true },
        channelId: { type: String, required: true },
        /** Empty while the number is reserved and the post is being sent. */
        messageId: { type: String, default: "" },
        imageName: { type: String, required: true },
        removed: { type: Boolean, default: false },
    },
    { timestamps: true },
);
competitionEntrySchema.index({ guildId: 1, number: 1 }, { unique: true });

/** One member's vote. A member has one vote in the whole competition (unique `{guildId, voterId}`). */
export interface ICompetitionVote extends Document {
    guildId: string;
    voterId: string;
    number: number;
    createdAt: Date;
}

const competitionVoteSchema = new Schema<ICompetitionVote>(
    {
        guildId: { type: String, required: true },
        voterId: { type: String, required: true },
        number: { type: Number, required: true },
    },
    { timestamps: true },
);
competitionVoteSchema.index({ guildId: 1, voterId: 1 }, { unique: true });
competitionVoteSchema.index({ guildId: 1, number: 1 });

export const CompetitionBot = model<ICompetitionBot>("TempCompetitionBot", competitionBotSchema);
export const CompetitionEntry = model<ICompetitionEntry>("TempCompetitionEntry", competitionEntrySchema);
export const CompetitionVote = model<ICompetitionVote>("TempCompetitionVote", competitionVoteSchema);

/** The lowest number no entry holds — a number freed by `!delete` is given out again. */
export async function lowestFreeNumber(guildId: string): Promise<number> {
    const taken = new Set((await CompetitionEntry.find({ guildId }, { number: 1 }).lean()).map(e => e.number));
    let n = 1;
    while (taken.has(n)) n++;
    return n;
}

export async function voteCount(guildId: string, number: number): Promise<number> {
    return CompetitionVote.countDocuments({ guildId, number });
}

/** number → votes, for every entry that has any. */
export async function voteCounts(guildId: string): Promise<Map<number, number>> {
    const rows = await CompetitionVote.aggregate<{ _id: number; n: number }>([
        { $match: { guildId } },
        { $group: { _id: "$number", n: { $sum: 1 } } },
    ]);
    return new Map(rows.map(r => [r._id, r.n]));
}
