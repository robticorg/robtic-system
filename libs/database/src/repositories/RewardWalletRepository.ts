import { RewardWallet, type IRewardWallet } from "@database/models/RewardWallet";
import { RewardTransaction, type RewardTransactionType } from "@database/models/RewardTransaction";

export interface RewardMovement {
    guildId: string;
    discordId: string;
    username: string;
    /** Signed: positive credits the wallet, negative debits it. */
    amount: number;
    type: RewardTransactionType;
    detail?: string;
    actorId?: string | null;
    /** Makes this movement replayable exactly once. See `IRewardTransaction.idempotencyKey`. */
    idempotencyKey?: string;
}

/**
 * Placeholder `balanceAfter` on a claimed-but-not-yet-applied ledger row.
 *
 * Negative so it can never be mistaken for a real balance, and greppable so an operator can find a
 * movement interrupted between claiming the key and moving the balance.
 */
export const UNSETTLED_REWARD_BALANCE = -1;

/**
 * The only repository allowed to move a Credits balance.
 *
 * Mirrors `PointsRepository`: every mutation is a single atomic `findOneAndUpdate`, and every
 * movement writes its own ledger row so a balance can always be explained by summing
 * `RewardTransaction`. Nothing outside `libs/core/src/rewards` (the wallet service) should call
 * `move` directly — see that module for why.
 */
export class RewardWalletRepository {
    static async findOrCreate(guildId: string, discordId: string, username: string): Promise<IRewardWallet> {
        return RewardWallet.findOneAndUpdate(
            { guildId, discordId },
            { $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IRewardWallet>;
    }

    static async get(guildId: string, discordId: string): Promise<IRewardWallet | null> {
        return RewardWallet.findOne({ guildId, discordId });
    }

    /**
     * Applies a signed movement and writes the ledger row for it.
     *
     * `lifetimeEarned` only ever climbs. A negative amount adds to `lifetimeWithdrawn` when
     * `type` is `WITHDRAW`, and to `lifetimeSpent` otherwise — so "earned all-time" and "spent
     * all-time" both stay meaningful after a member cashes out.
     *
     * With an `idempotencyKey` the ledger row is claimed *before* the balance moves, exactly like
     * `PointsRepository.move`: a crash in the gap leaves a claimed-but-unsettled row rather than
     * risking a double pay on retry. Unsettled rows are findable by
     * `balanceAfter === UNSETTLED_REWARD_BALANCE`.
     */
    static async move(input: RewardMovement): Promise<IRewardWallet> {
        const { guildId, discordId, username, amount, type, detail = "", actorId = null, idempotencyKey } = input;

        if (idempotencyKey) {
            const claimed = await this.claimLedgerRow(input, idempotencyKey);
            if (!claimed) return this.findOrCreate(guildId, discordId, username);
        }

        const inc: Record<string, number> = { balance: amount };
        if (amount > 0) inc.lifetimeEarned = amount;
        else if (amount < 0) inc[type === "WITHDRAW" ? "lifetimeWithdrawn" : "lifetimeSpent"] = -amount;

        const updated = await RewardWallet.findOneAndUpdate(
            { guildId, discordId },
            { $inc: inc, $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as IRewardWallet;

        if (idempotencyKey) {
            await RewardTransaction.updateOne({ idempotencyKey }, { $set: { balanceAfter: updated.balance } });
            return updated;
        }

        await RewardTransaction.create({
            guildId,
            discordId,
            amount,
            type,
            detail,
            balanceAfter: updated.balance,
            actorId,
        });

        return updated;
    }

    /**
     * Reserves the ledger row for a keyed movement. False means someone already has it.
     *
     * The partial unique index on `idempotencyKey` is the arbiter, so two processes racing the
     * same key resolve without a transaction — see `PointsRepository.claimLedgerRow`, which this
     * mirrors exactly.
     */
    private static async claimLedgerRow(input: RewardMovement, idempotencyKey: string): Promise<boolean> {
        const { guildId, discordId, amount, type, detail = "", actorId = null } = input;

        try {
            const result = await RewardTransaction.updateOne(
                { idempotencyKey },
                {
                    $setOnInsert: {
                        guildId, discordId, amount, type, detail, actorId, idempotencyKey,
                        balanceAfter: UNSETTLED_REWARD_BALANCE,
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

    static async getTop(guildId: string, limit = 10): Promise<IRewardWallet[]> {
        return RewardWallet.find({ guildId }).sort({ balance: -1 }).limit(limit);
    }

    static async getRank(guildId: string, discordId: string): Promise<number> {
        const record = await RewardWallet.findOne({ guildId, discordId });
        if (!record) return 0;
        return (await RewardWallet.countDocuments({ guildId, balance: { $gt: record.balance } })) + 1;
    }
}
