import { Schema, model, type Document } from "mongoose";

/**
 * Where a Credits movement came from.
 *
 * Kept open-ended deliberately, the same way `PointSource` is: a new reward source adds a value
 * here and nothing else about the ledger changes. Drops, events, quests and Minecraft rewards are
 * listed ahead of having a producer, so the ledger shape never needs a migration when one arrives.
 */
export const REWARD_TRANSACTION_TYPES = [
    "MESSAGE_REWARD",
    "VOICE_REWARD",
    "DROP_REWARD",
    "EVENT_REWARD",
    "SHOP_PURCHASE",
    "WITHDRAW",
    "ADMIN_ADJUSTMENT",
] as const;

export type RewardTransactionType = typeof REWARD_TRANSACTION_TYPES[number];

/**
 * An append-only ledger of every Credits movement — the auditable record behind `RewardWallet`.
 *
 * Never updated, only inserted, mirroring `PointHistory`: a balance can always be explained by
 * summing its ledger, and a bad award is traced rather than guessed at.
 */
export interface IRewardTransaction extends Document {
    guildId: string;
    discordId: string;
    /** Signed: positive earned, negative spent or withdrawn. */
    amount: number;
    type: RewardTransactionType;
    /** Free-text context, e.g. "300 daily messages" or the admin's reason. */
    detail: string;
    /** Balance immediately after this movement, so the ledger reads without re-summing. */
    balanceAfter: number;
    /** Who caused it, when that is someone other than the member. */
    actorId: string | null;
    /**
     * Optional caller-supplied key making a movement replayable exactly once.
     *
     * Mirrors `PointHistory.idempotencyKey`: anything driven by a lease, a buffer, or a scheduler
     * that can retry supplies one, so a resumed claim cannot pay twice. The partial unique index
     * below is what turns a replay into an E11000 the wallet service treats as "already done".
     */
    idempotencyKey: string | null;
    createdAt: Date;
}

const rewardTransactionSchema = new Schema<IRewardTransaction>(
    {
        guildId: { type: String, required: true, index: true },
        discordId: { type: String, required: true, index: true },
        amount: { type: Number, required: true },
        type: { type: String, required: true, enum: REWARD_TRANSACTION_TYPES },
        detail: { type: String, default: "" },
        balanceAfter: { type: Number, required: true },
        actorId: { type: String, default: null },
        idempotencyKey: { type: String, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

rewardTransactionSchema.index({ guildId: 1, discordId: 1, createdAt: -1 });
rewardTransactionSchema.index({ guildId: 1, type: 1, createdAt: -1 });

rewardTransactionSchema.index(
    { idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const RewardTransaction = model<IRewardTransaction>("RewardTransaction", rewardTransactionSchema);
