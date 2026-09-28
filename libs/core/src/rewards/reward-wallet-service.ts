import { RewardWalletRepository } from "@database/repositories";
import type { IRewardWallet, RewardTransactionType } from "@database/models";

export interface RewardWalletMovement {
    guildId: string;
    discordId: string;
    username: string;
    /** Always positive — direction is decided by which function is called, never by the sign. */
    amount: number;
    detail?: string;
    actorId?: string | null;
    idempotencyKey?: string;
}

/**
 * The single centralized entry point for changing a Credits balance.
 *
 * Nothing else — no event handler, no command, no scheduler — may write to `RewardWallet`
 * directly. Routing every change through here is what keeps the ledger (`RewardTransaction`)
 * complete: a balance that could move any other way could also move without a transaction row to
 * explain it.
 */

/** Credits a reward. `type` must be one of the reward-paying transaction types. */
export async function creditReward(
    input: RewardWalletMovement & { type: Exclude<RewardTransactionType, "WITHDRAW"> },
): Promise<IRewardWallet> {
    if (input.amount <= 0) return RewardWalletRepository.findOrCreate(input.guildId, input.discordId, input.username);
    return RewardWalletRepository.move({ ...input, amount: input.amount });
}

/** Debits a purchase or an admin correction. `amount` is the positive size of the debit. */
export async function debitReward(
    input: RewardWalletMovement & { type: Extract<RewardTransactionType, "SHOP_PURCHASE" | "ADMIN_ADJUSTMENT"> },
): Promise<IRewardWallet> {
    if (input.amount <= 0) return RewardWalletRepository.findOrCreate(input.guildId, input.discordId, input.username);
    return RewardWalletRepository.move({ ...input, amount: -input.amount });
}

/**
 * Withdraws Credits out of the wallet (the eventual conversion/withdrawal path). Only prepares the
 * balance movement and its ledger row — the conversion system itself is future work.
 */
export async function withdrawReward(input: RewardWalletMovement): Promise<IRewardWallet> {
    if (input.amount <= 0) return RewardWalletRepository.findOrCreate(input.guildId, input.discordId, input.username);
    return RewardWalletRepository.move({ ...input, amount: -input.amount, type: "WITHDRAW" });
}
