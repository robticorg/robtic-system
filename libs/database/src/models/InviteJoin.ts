import { Schema, model, type Document } from "mongoose";

export type InviteJoinSource = "invite" | "vanity" | "unknown";

/**
 * One member joining a guild, and how — the history behind `/invites` and `/info`.
 *
 * Deliberately separate from `RewardInviteCredit`: that is the *reward* record (at most one per
 * invitee, ever, and only while the inviter has a free slot), while this records every join as it
 * happened, rejoins included, so Joins and Leaves can be counted the way members expect. A row is
 * never deleted; leaving only sets `leftAt` on that member's latest join.
 *
 * The unique index on `{guildId, inviteeId, joinedAt}` makes a replayed join event a no-op — the
 * same join always carries the same `joinedAt`.
 */
export interface IInviteJoin extends Document {
    guildId: string;
    inviteeId: string;
    /** Who owns the invite used. `null` for the vanity URL or an undetectable join. */
    inviterId: string | null;
    inviteCode: string | null;
    source: InviteJoinSource;
    joinedAt: Date;
    leftAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const inviteJoinSchema = new Schema<IInviteJoin>(
    {
        guildId: { type: String, required: true },
        inviteeId: { type: String, required: true },
        inviterId: { type: String, default: null },
        inviteCode: { type: String, default: null },
        source: { type: String, enum: ["invite", "vanity", "unknown"], required: true },
        joinedAt: { type: Date, required: true },
        leftAt: { type: Date, default: null },
    },
    { timestamps: true }
);

inviteJoinSchema.index({ guildId: 1, inviteeId: 1, joinedAt: 1 }, { unique: true });
inviteJoinSchema.index({ guildId: 1, inviterId: 1, joinedAt: -1 });

export const InviteJoin = model<IInviteJoin>("InviteJoin", inviteJoinSchema);
