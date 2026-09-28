import type { RewardTransactionType } from "@database/models";
import { calculateReward, type RewardCalculation } from "./reward-calculator";
import { resolveRewardBonuses, type UnwiredRewardBonusInputs } from "./resolve-reward-bonuses";
import { creditReward } from "./reward-wallet-service";

/** Transaction types a reward source may claim through. Purchases, withdrawals and admin corrections go through the wallet service directly instead. */
export type RewardClaimType = Extract<
    RewardTransactionType,
    "MESSAGE_REWARD" | "VOICE_REWARD" | "DROP_REWARD" | "EVENT_REWARD" | "QUEST_REWARD"
>;

export interface ClaimRewardInput {
    guildId: string;
    discordId: string;
    username: string;
    /** The member's currently held role ids — used only to resolve the staff bonus. */
    roleIds: readonly string[];
    /** The base reward, in internal wallet units, before any bonus is applied. */
    baseUnits: number;
    type: RewardClaimType;
    detail?: string;
    idempotencyKey?: string;
    bonusInputs?: UnwiredRewardBonusInputs;
    /** Overrides "now" — for tests only. Also decides which UTC day the Server Tag window is checked against. */
    now?: Date;
}

export interface ClaimRewardResult {
    calculation: RewardCalculation;
}

/**
 * The one entry point every reward source — messages, voice, and eventually drops, events, quests
 * and Minecraft rewards — is meant to call. Resolves the member's current bonuses, applies the
 * reward formula, and credits the wallet through the single service allowed to move a balance.
 *
 * A source pays nothing itself: it decides `baseUnits` (from its own threshold or roll) and hands
 * everything else to this function, so the bonus formula and the ledger stay in exactly one place
 * no matter how many sources eventually exist.
 */
export async function claimReward(input: ClaimRewardInput): Promise<ClaimRewardResult> {
    const breakdown = await resolveRewardBonuses(input.guildId, input.discordId, input.roleIds, input.bonusInputs, input.now);
    const calculation = calculateReward(input.baseUnits, breakdown);

    if (calculation.final > 0) {
        await creditReward({
            guildId: input.guildId,
            discordId: input.discordId,
            username: input.username,
            amount: calculation.final,
            type: input.type,
            detail: input.detail,
            idempotencyKey: input.idempotencyKey,
        });
    }

    return { calculation };
}
