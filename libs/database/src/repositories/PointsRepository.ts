import { Point, type IPoint } from "@database/models/Point";
import { PointHistory, type PointSource } from "@database/models/PointHistory";

export interface PointMovement {
    guildId: string;
    discordId: string;
    username: string;
    /** Signed: positive earned, negative spent. */
    amount: number;
    source: PointSource;
    detail?: string;
    actorId?: string | null;
    /**
     * Makes this movement replayable exactly once.
     *
     * Supply it from anything that can retry — a lease, a buffered worker, a scheduler resuming
     * after a crash. Omit it from interactive paths, which cannot replay and would only be
     * inventing a key.
     */
    idempotencyKey?: string;
}

export type ProgressKind = "message" | "combo" | "voice";

/**
 * Placeholder `balanceAfter` on a claimed-but-not-yet-applied ledger row.
 *
 * Negative so it can never be mistaken for a real balance, and greppable so an operator can find
 * movements interrupted between claiming the key and moving the points.
 */
export const UNSETTLED_BALANCE = -1;

const PROGRESS_FIELD: Record<ProgressKind, keyof IPoint & string> = {
    message: "messageProgress",
    combo: "comboProgress",
    voice: "voiceProgress",
};


/** Keys each wallet remembers for `addProgressOnce` — far more than a job's retry window can produce. */
const RECENT_PROGRESS_KEYS = 50;
export class PointsRepository {
    static async findOrCreate(guildId: string, discordId: string, username: string): Promise<IPoint> {
        return Point.findOneAndUpdate(
            { guildId, discordId },
            { $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IPoint>;
    }

    static async get(guildId: string, discordId: string): Promise<IPoint | null> {
        return Point.findOne({ guildId, discordId });
    }

    /**
     * Applies a signed movement and writes the ledger row for it.
     *
     * `lifetimePoints` only ever climbs — spending reduces the balance alone, so "earned" stays a
     * meaningful statistic after a member cashes out.
     *
     * With an `idempotencyKey` the ledger row is claimed *before* the balance moves, so a replay
     * can never pay twice. That ordering trades one failure mode for a better one: a crash in the
     * gap leaves a claimed row whose balance never moved — the member is short-changed, and the
     * retry sees the key and declines. Unsettled rows are findable by
     * `balanceAfter === UNSETTLED_BALANCE`. The reverse order would double-pay instead, which is
     * silent, self-inflating, and the reason `convert-points-to-rc` deducts before it credits.
     */
    static async move(input: PointMovement): Promise<IPoint> {
        const { guildId, discordId, username, amount, source, detail = "", actorId = null, idempotencyKey } = input;

        if (idempotencyKey) {
            const claimed = await this.claimLedgerRow(input, idempotencyKey);
            if (!claimed) return this.findOrCreate(guildId, discordId, username);
        }

        const updated = await Point.findOneAndUpdate(
            { guildId, discordId },
            {
                $inc: { points: amount, ...(amount > 0 ? { lifetimePoints: amount } : {}) },
                $setOnInsert: { username },
            },
            { upsert: true, returnDocument: "after" }
        ) as IPoint;

        if (idempotencyKey) {
            await PointHistory.updateOne({ idempotencyKey }, { $set: { balanceAfter: updated.points } });
            return updated;
        }

        await PointHistory.create({
            guildId,
            discordId,
            amount,
            source,
            detail,
            balanceAfter: updated.points,
            actorId,
        });

        return updated;
    }

    /**
     * Reserves the ledger row for a keyed movement. False means someone already has it.
     *
     * The partial unique index on `idempotencyKey` is the arbiter, so two processes racing the same
     * key resolve without a transaction: one upserts, the other either matches nothing or trips
     * E11000, and both outcomes read as "already claimed".
     */
    private static async claimLedgerRow(input: PointMovement, idempotencyKey: string): Promise<boolean> {
        const { guildId, discordId, amount, source, detail = "", actorId = null } = input;

        try {
            const result = await PointHistory.updateOne(
                { idempotencyKey },
                {
                    $setOnInsert: {
                        guildId, discordId, amount, source, detail, actorId, idempotencyKey,
                        balanceAfter: UNSETTLED_BALANCE,
                    },
                },
                { upsert: true }
            );

            return (result.upsertedCount ?? 0) > 0;
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return false;
            throw err;
        }
    }

    /**
     * Adds progress from one source and converts whole units into Points.
     *
     * The remainder is carried rather than dropped (`progress -= earned * rate`), so nothing is
     * lost at the boundary and a member who is one message short keeps that message.
     */
    /**
     * `addProgress` for queued work: exactly once per `key`, even across retries and out-of-order
     * jobs. (1) the progress is added unless `key` is among the recent keys; (2) the conversion is
     * claimed by a conditional decrement that records `{key, earned}`; (3) the Points are paid
     * through the ledger with an idempotency key. A crash anywhere is finished by the retry: it
     * finds the recorded conversion and re-pays it, which the ledger turns into a no-op if (3)
     * already happened. Returns the Points paid for `key`.
     */
    static async addProgressOnce(
        guildId: string,
        discordId: string,
        username: string,
        kind: ProgressKind,
        amount: number,
        rate: number,
        key: string,
    ): Promise<number> {
        if (rate <= 0 || amount <= 0) return 0;
        const field = PROGRESS_FIELD[kind];
        await this.findOrCreate(guildId, discordId, username);

        await Point.updateOne(
            { guildId, discordId, progressKeys: { $ne: key } },
            { $inc: { [field]: amount }, $push: { progressKeys: { $each: [key], $slice: -RECENT_PROGRESS_KEYS } } },
        );

        const converted = async () => {
            const row = await Point.findOne({ guildId, discordId }).lean();
            return { row, earned: row?.progressConversions?.find(c => c.key === key)?.earned };
        };

        let { row, earned } = await converted();
        if (earned === undefined) {
            const progress = (row?.[field] as number | undefined) ?? 0;
            const due = Math.floor(progress / rate);
            if (due <= 0) return 0;

            const claimed = await Point.updateOne(
                { guildId, discordId, "progressConversions.key": { $ne: key }, [field]: { $gte: due * rate } },
                {
                    $inc: { [field]: -due * rate },
                    $push: { progressConversions: { $each: [{ key, earned: due }], $slice: -RECENT_PROGRESS_KEYS } },
                },
            );
            if (claimed.modifiedCount > 0) earned = due;
            else ({ earned } = await converted());
            if (earned === undefined) return 0;
        }
        if (earned <= 0) return 0;

        await this.move({ guildId, discordId, username, amount: earned, source: kind, idempotencyKey: `${kind}-progress_${key}` });
        return earned;
    }

    static async addProgress(
        guildId: string,
        discordId: string,
        username: string,
        kind: ProgressKind,
        amount: number,
        rate: number,
        detail = "",
    ): Promise<number> {
        if (rate <= 0 || amount <= 0) return 0;
        const field = PROGRESS_FIELD[kind];

        const record = await Point.findOneAndUpdate(
            { guildId, discordId },
            { $inc: { [field]: amount }, $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as IPoint;

        const earned = Math.floor((record[field] as number) / rate);
        if (earned <= 0) return 0;

        await Point.updateOne(
            { guildId, discordId },
            { $inc: { [field]: -earned * rate } },
        );

        await this.move({ guildId, discordId, username, amount: earned, source: kind, detail });
        return earned;
    }

    /**
     * Batched message progress → Points, exactly once per flush batch, crash-safe at every step:
     *
     * 1. add the batch to `messageProgress` (guard: `msgFlushBatch`);
     * 2. pay the whole Points it now covers through `move` with an idempotency key derived from
     *    the batch — a retry finds the ledger row and pays nothing twice;
     * 3. take the paid progress back (guard: `msgConvertBatch`).
     *
     * A retry after step 2 re-reads the same progress (step 3 hadn't run), computes the same Points,
     * is refused by the ledger, and finishes step 3. Unlike `addProgress`, two calls can never both
     * convert the same progress. Returns the Points paid by this call.
     */
    static async addMessageProgressBatch(
        guildId: string,
        discordId: string,
        username: string,
        amount: number,
        rate: number,
        batchId: string,
    ): Promise<number> {
        await this.findOrCreate(guildId, discordId, username);
        if (amount > 0) {
            await Point.updateOne(
                { guildId, discordId, msgFlushBatch: { $ne: batchId } },
                { $inc: { messageProgress: amount }, $set: { msgFlushBatch: batchId } },
            );
        }

        const current = await Point.findOne({ guildId, discordId });
        if (!current || current.msgConvertBatch === batchId) return 0;

        const earned = rate > 0 ? Math.floor((current.messageProgress ?? 0) / rate) : 0;
        if (earned > 0) {
            await this.move({
                guildId, discordId, username, amount: earned, source: "message",
                idempotencyKey: `message-progress_${batchId}_${guildId}_${discordId}`,
            });
        }

        const taken = await Point.updateOne(
            { guildId, discordId, msgConvertBatch: { $ne: batchId } },
            { $inc: { messageProgress: -earned * rate }, $set: { msgConvertBatch: batchId } },
        );
        return taken.modifiedCount > 0 ? earned : 0;
    }

    /** Moves RC without touching Points — the conversion service handles both sides. */
    static async addRc(guildId: string, discordId: string, amount: number): Promise<IPoint> {
        return Point.findOneAndUpdate(
            { guildId, discordId },
            { $inc: { rc: amount } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IPoint>;
    }

    static async getTop(guildId: string, limit = 10): Promise<IPoint[]> {
        return Point.find({ guildId }).sort({ points: -1 }).limit(limit);
    }

    static async getRank(guildId: string, discordId: string): Promise<number> {
        const record = await Point.findOne({ guildId, discordId });
        if (!record) return 0;
        return (await Point.countDocuments({ guildId, points: { $gt: record.points } })) + 1;
    }
}
