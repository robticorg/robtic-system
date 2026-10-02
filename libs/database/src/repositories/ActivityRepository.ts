import type { Types } from "mongoose";
import { ActivityXP, type IActivityXP } from "@database/models/ActivityXP";

export class ActivityRepository {
    static async find(discordId: string, guildId: string): Promise<IActivityXP | null> {
        return ActivityXP.findOne({ discordId, guildId });
    }

    static async findOrCreate(discordId: string, guildId: string, username: string): Promise<IActivityXP> {
        let record = await ActivityXP.findOne({ discordId, guildId });
        if (!record) {
            record = await ActivityXP.create({ discordId, guildId, username });
        }
        return record;
    }

    /** Chat XP: raises `messageXP` (and the combined `totalXP`), never voice. */
    static async addXP(discordId: string, guildId: string, amount: number): Promise<IActivityXP | null> {
        return ActivityXP.findOneAndUpdate(
            { discordId, guildId },
            {
                $inc: { totalXP: amount, messageXP: amount, messageCount: 1 },
                lastMessageAt: new Date(),
                lastXPGrant: new Date(),
                "decay.lastActiveAt": new Date(),
                "decay.messageActiveAt": new Date(),
                "decay.inactiveDays": 0,
            },
            { returnDocument: "after" }
        );
    }

    /**
     * Voice XP: raises `voiceXP` (and the combined `totalXP`), never message XP.
     *
     * Deliberately not addXP: that one bumps messageCount and lastMessageAt, which would make a
     * member who sat in voice all evening look like they had been talking in text channels, and
     * would corrupt the message leaderboard.
     */
    static async addVoiceXP(discordId: string, guildId: string, amount: number): Promise<IActivityXP | null> {
        return ActivityXP.findOneAndUpdate(
            { discordId, guildId },
            {
                $inc: { totalXP: amount, voiceXP: amount },
                "decay.lastActiveAt": new Date(),
                "decay.voiceActiveAt": new Date(),
                "decay.inactiveDays": 0,
            },
            { returnDocument: "after" }
        );
    }

    static async getLeaderboard(guildId: string, limit = 10): Promise<IActivityXP[]> {
        return ActivityXP.find({ guildId })
            .sort({ totalXP: -1 })
            .limit(limit);
    }

    static async getRank(discordId: string, guildId: string): Promise<number> {
        const user = await ActivityXP.findOne({ discordId, guildId });
        if (!user) return -1;
        const above = await ActivityXP.countDocuments({
            guildId,
            totalXP: { $gt: user.totalXP },
        });
        return above + 1;
    }

    /** Counts a real message, and — in the same write — restarts the member's message-decay clock. */
    static async incrementRealMessageCount(discordId: string, guildId: string, username: string): Promise<IActivityXP | null> {
        await ActivityRepository.findOrCreate(discordId, guildId, username);
        return ActivityXP.findOneAndUpdate(
            { discordId, guildId },
            { $inc: { realMessageCount: 1 }, $set: { "decay.messageActiveAt": new Date() } },
            { returnDocument: "after" }
        );
    }

    static async addSupportPoints(discordId: string, guildId: string, amount: number): Promise<IActivityXP | null> {
        return ActivityXP.findOneAndUpdate(
            { discordId, guildId },
            {
                $inc: { "staff.supportPoints": amount },
                "decay.lastActiveAt": new Date(),
                "decay.inactiveDays": 0,
            },
            { returnDocument: "after" }
        );
    }

    static async addModerationPoints(discordId: string, guildId: string, username: string, amount: number): Promise<IActivityXP | null> {
        await this.findOrCreate(discordId, guildId, username);
        return ActivityXP.findOneAndUpdate(
            { discordId, guildId },
            {
                $inc: { "staff.moderationPoints": amount },
                "decay.lastActiveAt": new Date(),
                "decay.inactiveDays": 0,
            },
            { returnDocument: "after" }
        );
    }

    /**
     * One day's decay, as decided by `decayLossForKind` for each kind, with the levels that result.
     * Each kind that lost XP has its `…DecayedAt` stamped, which is what limits it to once a day.
     */
    static async applyDecay(
        discordId: string,
        guildId: string,
        loss: { messageLoss: number; voiceLoss: number },
        levels: { level: number; messageLevel: number; voiceLevel: number },
        at: Date,
    ): Promise<IActivityXP | null> {
        const total = loss.messageLoss + loss.voiceLoss;
        return ActivityXP.findOneAndUpdate(
            { discordId, guildId },
            {
                $inc: { totalXP: -total, messageXP: -loss.messageLoss, voiceXP: -loss.voiceLoss },
                $set: {
                    ...levels,
                    ...(loss.messageLoss > 0 ? { "decay.messageDecayedAt": at } : {}),
                    ...(loss.voiceLoss > 0 ? { "decay.voiceDecayedAt": at } : {}),
                },
            },
            { returnDocument: "after" }
        );
    }

    /** Members with message XP idle since `since`, or voice XP idle since `since` — decay candidates. */
    static async getInactiveUsers(guildId: string, since: Date): Promise<IActivityXP[]> {
        return ActivityXP.find({
            guildId,
            "decay.enabled": true,
            $or: [
                { messageXP: { $gt: 0 }, "decay.messageActiveAt": { $lt: since } },
                { voiceXP: { $gt: 0 }, "decay.voiceActiveAt": { $lt: since } },
            ],
        });
    }

    /**
     * Gives records from before the per-kind clocks a starting point: both clocks start at the
     * member's last known activity, so nobody decays early because a field was missing.
     */
    static async backfillDecayClocks(): Promise<number> {
        const result = await ActivityXP.updateMany(
            { "decay.messageActiveAt": { $exists: false } },
            [{ $set: {
                "decay.messageActiveAt": { $ifNull: ["$decay.lastActiveAt", "$$NOW"] },
                "decay.voiceActiveAt": { $ifNull: ["$decay.lastActiveAt", "$$NOW"] },
                "decay.messageDecayedAt": null,
                "decay.voiceDecayedAt": null,
            } }],
            // Mongoose 9 refuses an update pipeline (the array above) unless it is asked for.
            { updatePipeline: true },
        );
        return result.modifiedCount;
    }

    /** Stores the levels after an XP gain. Only the fields given are written. */
    static async setLevels(
        discordId: string,
        guildId: string,
        levels: Partial<Pick<IActivityXP, "level" | "messageLevel" | "voiceLevel">>,
    ): Promise<void> {
        await ActivityXP.updateOne({ discordId, guildId }, { $set: levels });
    }

    /** Records not yet split into message/voice XP — only rows written before the split exist without `messageXP`. */
    static async findUnsplit(limit: number): Promise<Array<{ _id: Types.ObjectId; guildId: string; discordId: string; totalXP: number }>> {
        return ActivityXP.find({ messageXP: { $exists: false } }).select("guildId discordId totalXP").limit(limit).lean();
    }

    /**
     * Writes the split for pre-split records. Each update is conditional on the row still being
     * unsplit, so running it twice, or alongside a live XP gain, never overwrites a split row.
     */
    static async applySplit(rows: Array<{ id: Types.ObjectId; messageXP: number; voiceXP: number; messageLevel: number; voiceLevel: number }>): Promise<void> {
        if (!rows.length) return;
        await ActivityXP.bulkWrite(rows.map(({ id, ...fields }) => ({
            updateOne: { filter: { _id: id, messageXP: { $exists: false } }, update: { $set: fields } },
        })), { ordered: false });
    }

    static async setDecayEnabled(discordId: string, guildId: string, enabled: boolean): Promise<void> {
        await ActivityXP.updateOne({ discordId, guildId }, { "decay.enabled": enabled });
    }

    /** Members with any recorded staff points, sorted by net total (points minus penalties). */
    static async getStaffActivityOverview(
        guildId: string,
        limit = 50,
    ): Promise<Array<{ discordId: string; staff: IActivityXP["staff"]; totalStaffPoints: number }>> {
        return ActivityXP.aggregate([
            {
                $match: {
                    guildId,
                    $or: [
                        { "staff.supportPoints": { $gt: 0 } },
                        { "staff.publicChatPoints": { $gt: 0 } },
                        { "staff.staffChatPoints": { $gt: 0 } },
                        { "staff.moderationPoints": { $gt: 0 } },
                        { "staff.penalties": { $gt: 0 } },
                    ],
                },
            },
            {
                $addFields: {
                    totalStaffPoints: {
                        $subtract: [
                            {
                                $add: [
                                    "$staff.supportPoints",
                                    "$staff.publicChatPoints",
                                    "$staff.staffChatPoints",
                                    "$staff.moderationPoints",
                                ],
                            },
                            "$staff.penalties",
                        ],
                    },
                },
            },
            { $sort: { totalStaffPoints: -1 } },
            { $limit: limit },
            { $project: { _id: 0, discordId: 1, staff: 1, totalStaffPoints: 1 } },
        ]);
    }
}
