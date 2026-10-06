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
     * Queued chat XP, applied exactly once per `jobKey` (the row remembers its last 20 job keys, so
     * even a retry that arrives after newer gains is refused). The update is one pipeline, so the levels
     * *before* this gain are snapshotted in the same write (`xpJobPrev`): a retry after a crash
     * still knows whether this gain was a level-up. Times only move forward (`$max`), so a late
     * retry can't rewind a clock.
     *
     * Returns the row after the gain and the levels before it — or `prev: null` when a newer job has
     * already replaced this one's snapshot (nothing left to decide for this job).
     */
    static async addMessageXpOnce(
        discordId: string,
        guildId: string,
        username: string,
        amount: number,
        at: Date,
        jobKey: string,
    ): Promise<{ applied: boolean; record: IActivityXP | null; prev: { level: number; messageLevel: number; voiceLevel: number } | null }> {
        await ActivityRepository.findOrCreate(discordId, guildId, username);
        const later = (field: string) => ({ $max: [{ $ifNull: [`$${field}`, at] }, at] });

        const applied = await ActivityXP.findOneAndUpdate(
            { discordId, guildId, xpJobs: { $ne: jobKey } },
            [{
                $set: {
                    xpJobPrev: {
                        level: { $ifNull: ["$level", 0] },
                        messageLevel: { $ifNull: ["$messageLevel", 0] },
                        voiceLevel: { $ifNull: ["$voiceLevel", 0] },
                    },
                    xpJobs: { $slice: [{ $concatArrays: [{ $ifNull: ["$xpJobs", []] }, [jobKey]] }, -20] },
                    totalXP: { $add: [{ $ifNull: ["$totalXP", 0] }, amount] },
                    messageXP: { $add: [{ $ifNull: ["$messageXP", 0] }, amount] },
                    messageCount: { $add: [{ $ifNull: ["$messageCount", 0] }, 1] },
                    lastMessageAt: later("lastMessageAt"),
                    lastXPGrant: later("lastXPGrant"),
                    "decay.lastActiveAt": later("decay.lastActiveAt"),
                    "decay.messageActiveAt": later("decay.messageActiveAt"),
                    "decay.inactiveDays": 0,
                },
            }],
            { returnDocument: "after", updatePipeline: true },
        );
        if (applied) return { applied: true, record: applied, prev: applied.xpJobPrev };

        const record = await ActivityXP.findOne({ discordId, guildId });
        return { applied: false, record, prev: record?.xpJobs.at(-1) === jobKey ? record.xpJobPrev : null };
    }

    /**
     * Queued voice XP for one tick, applied exactly once per `jobKey` — `addMessageXpOnce`'s twin,
     * with its own guard (`voiceXpJobs`, last 20) and levels-before snapshot (`voiceXpJobPrev`).
     * Like `addVoiceXP` it never touches the message counters.
     */
    static async addVoiceXpOnce(
        discordId: string,
        guildId: string,
        username: string,
        amount: number,
        at: Date,
        jobKey: string,
    ): Promise<{ applied: boolean; record: IActivityXP | null; prev: { level: number; messageLevel: number; voiceLevel: number } | null }> {
        await ActivityRepository.findOrCreate(discordId, guildId, username);
        const later = (field: string) => ({ $max: [{ $ifNull: [`$${field}`, at] }, at] });

        const applied = await ActivityXP.findOneAndUpdate(
            { discordId, guildId, voiceXpJobs: { $ne: jobKey } },
            [{
                $set: {
                    voiceXpJobPrev: {
                        level: { $ifNull: ["$level", 0] },
                        messageLevel: { $ifNull: ["$messageLevel", 0] },
                        voiceLevel: { $ifNull: ["$voiceLevel", 0] },
                    },
                    voiceXpJobs: { $slice: [{ $concatArrays: [{ $ifNull: ["$voiceXpJobs", []] }, [jobKey]] }, -20] },
                    totalXP: { $add: [{ $ifNull: ["$totalXP", 0] }, amount] },
                    voiceXP: { $add: [{ $ifNull: ["$voiceXP", 0] }, amount] },
                    "decay.lastActiveAt": later("decay.lastActiveAt"),
                    "decay.voiceActiveAt": later("decay.voiceActiveAt"),
                    "decay.inactiveDays": 0,
                },
            }],
            { returnDocument: "after", updatePipeline: true },
        );
        if (applied) return { applied: true, record: applied, prev: applied.voiceXpJobPrev };

        const record = await ActivityXP.findOne({ discordId, guildId });
        return { applied: false, record, prev: record?.voiceXpJobs?.at(-1) === jobKey ? record.voiceXpJobPrev : null };
    }

    /** Raises levels, never lowers them — safe when two gains for one member finish out of order. */
    static async raiseLevels(
        discordId: string,
        guildId: string,
        levels: Partial<Pick<IActivityXP, "level" | "messageLevel" | "voiceLevel">>,
    ): Promise<void> {
        await ActivityXP.updateOne({ discordId, guildId }, { $max: levels });
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

    /**
     * Adds a flush batch's real messages — at most once per batch (`msgFlushBatch` guard), and moves
     * the message-decay clock forward (`$max`, never backwards). Returns the counter afterwards and
     * how many messages this batch added; on a repeat of an applied batch, the same numbers again,
     * so milestones can still be recomputed after a crash.
     */
    static async addRealMessagesBatch(
        discordId: string,
        guildId: string,
        username: string,
        count: number,
        lastActiveAt: Date,
        batchId: string,
    ): Promise<{ applied: boolean; total: number; added: number }> {
        await ActivityRepository.findOrCreate(discordId, guildId, username);
        const updated = await ActivityXP.findOneAndUpdate(
            { discordId, guildId, msgFlushBatch: { $ne: batchId } },
            {
                $inc: { realMessageCount: count },
                $max: { "decay.messageActiveAt": lastActiveAt },
                $set: { msgFlushBatch: batchId, msgFlushCount: count },
            },
            { returnDocument: "after" }
        );
        if (updated) return { applied: true, total: updated.realMessageCount, added: count };

        const current = await ActivityXP.findOne({ discordId, guildId });
        return {
            applied: false,
            total: current?.realMessageCount ?? 0,
            added: current?.msgFlushBatch === batchId ? current.msgFlushCount : 0,
        };
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
