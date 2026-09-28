import { Schema, model, type Document } from "mongoose";

/**
 * The one fact Discord does not expose about its own Server Tag feature: *how long* a member has
 * had it on. `User.primaryGuild` is a live on/off snapshot with no "since" timestamp, so the +10%
 * reward bonus (which requires 6 continuous hours today, see `REWARD_SERVER_TAG_BONUS`) has
 * nothing to check against without recording the first moment each day the tag was observed active.
 *
 * This is intentionally the smallest possible record — one timestamp, scoped to one UTC day. It is
 * not a general activity tracker: the moment the tag is observed inactive, its row for that day is
 * deleted (see `RewardServerTagPresenceRepository.clear`), so a member who removes the tag and
 * re-enables it starts the window over rather than resuming an old one.
 */
export interface IRewardServerTagPresence extends Document {
    guildId: string;
    discordId: string;
    /** UTC calendar day (`utcDateKey`) this row's `activeSince` applies to. */
    dayKey: string;
    /** The first moment today the tag was observed continuously active. */
    activeSince: Date;
    createdAt: Date;
    updatedAt: Date;
}

const rewardServerTagPresenceSchema = new Schema<IRewardServerTagPresence>(
    {
        guildId: { type: String, required: true, index: true },
        discordId: { type: String, required: true, index: true },
        dayKey: { type: String, required: true },
        activeSince: { type: Date, required: true },
    },
    { timestamps: true }
);

rewardServerTagPresenceSchema.index({ guildId: 1, discordId: 1, dayKey: 1 }, { unique: true });

export const RewardServerTagPresence = model<IRewardServerTagPresence>(
    "RewardServerTagPresence",
    rewardServerTagPresenceSchema
);
