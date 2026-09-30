import { BP_SCALE, REFERRAL_CODE_RULES, REWARD_REFERRAL_BONUS } from "@constants";
import { ReferralCodeRepository, ReferralCodeUseRepository } from "@database/repositories";
import type { IReferralCode } from "@database/models";
import { referralBonusBp } from "./reward-calculator";

/**
 * Referral Code bonus — a member applies one staff-created code, and while that code exists and is
 * active they get its configured bonus (capped at `REWARD_REFERRAL_BONUS.maxBp`).
 *
 * Nothing is stored on the member but the link (`ReferralCodeUse`): the bonus is read from the
 * code's current row at every claim, so deactivating a code is +0% on everyone's next claim,
 * reactivating it restores the bonus, and editing its bonus applies immediately.
 *
 * Rules for applying a code, all enforced here, server-side:
 * - the code must match `REFERRAL_CODE_RULES`, exist in this guild, and be active;
 * - a member cannot use a code they own;
 * - a member holds one code. Once linked they cannot switch — while their code exists (active or
 *   not) the link stands. Only a deleted code, or a staff reset, frees them to apply another.
 */

export interface ReferralCodeSnapshot {
    id: string;
    code: string;
    ownerId: string;
    bonusBp: number;
    active: boolean;
}

/** Everything the referral rules read or write — the repositories in production, a Map in tests. */
export interface ReferralStore {
    findUse(guildId: string, discordId: string): Promise<{ codeId: string } | null>;
    findCodeById(guildId: string, codeId: string): Promise<ReferralCodeSnapshot | null>;
    findCode(guildId: string, code: string): Promise<ReferralCodeSnapshot | null>;
    setUse(guildId: string, discordId: string, codeId: string, at: Date): Promise<void>;
}

function toSnapshot(row: IReferralCode | null): ReferralCodeSnapshot | null {
    if (!row) return null;
    return { id: String(row._id), code: row.code, ownerId: row.ownerId, bonusBp: row.bonusBp, active: row.active };
}

export const repositoryReferralStore: ReferralStore = {
    findUse: (guildId, discordId) => ReferralCodeUseRepository.find(guildId, discordId),
    findCodeById: async (guildId, codeId) => toSnapshot(await ReferralCodeRepository.findById(guildId, codeId)),
    findCode: async (guildId, code) => toSnapshot(await ReferralCodeRepository.findByCode(guildId, code)),
    setUse: (guildId, discordId, codeId, at) => ReferralCodeUseRepository.set(guildId, discordId, codeId, at),
};

/** The stored form of a typed code (trimmed, lowercase), or `null` if it can't be a code at all. */
export function normalizeReferralCode(input: string): string | null {
    const code = input.trim().toLowerCase();
    return REFERRAL_CODE_RULES.pattern.test(code) ? code : null;
}

/**
 * A staff-entered percentage (e.g. `12.5`) as whole basis points, or `null` when it is not a number
 * in `[0, max]`. Rejected rather than clamped, so staff learn the limit instead of silently getting it.
 */
export function referralPercentToBp(percent: number): number | null {
    if (!Number.isFinite(percent) || percent < 0) return null;
    const bp = Math.round(percent * (BP_SCALE / 100));
    return bp <= REWARD_REFERRAL_BONUS.maxBp ? bp : null;
}

/** The bonus a code grants right now: +0% unless it exists and is active, and never above the cap. */
export function referralCodeBonusBp(code: ReferralCodeSnapshot | null): number {
    if (!code || !code.active) return 0;
    return referralBonusBp(code.bonusBp);
}

/** The member's linked code (`null` if none, or if it was deleted) and what it grants right now. */
export async function getMemberReferral(
    guildId: string,
    discordId: string,
    store: ReferralStore = repositoryReferralStore,
): Promise<{ code: ReferralCodeSnapshot | null; bonusBp: number }> {
    const use = await store.findUse(guildId, discordId);
    const code = use ? await store.findCodeById(guildId, use.codeId) : null;
    return { code, bonusBp: referralCodeBonusBp(code) };
}

/** What the reward resolver calls: the member's current Referral Code bonus in basis points. */
export async function getReferralCodeBonusBp(
    guildId: string,
    discordId: string,
    store: ReferralStore = repositoryReferralStore,
): Promise<number> {
    return (await getMemberReferral(guildId, discordId, store)).bonusBp;
}

export type ReferralApplyDecision =
    | "applied"
    /** Not a well-formed code. */
    | "invalid"
    /** Well-formed, but no such code in this guild. */
    | "not-found"
    | "inactive"
    | "own-code"
    /** The member already holds a code that still exists. */
    | "already-linked";

/** Validates and applies a member-typed code. Every input is re-checked here; nothing from the caller is trusted. */
export async function applyReferralCode(
    guildId: string,
    discordId: string,
    rawCode: string,
    now: Date = new Date(),
    store: ReferralStore = repositoryReferralStore,
): Promise<{ decision: ReferralApplyDecision; code: ReferralCodeSnapshot | null }> {
    const normalized = normalizeReferralCode(rawCode);
    if (!normalized) return { decision: "invalid", code: null };

    const current = await getMemberReferral(guildId, discordId, store);
    if (current.code) return { decision: "already-linked", code: current.code };

    const code = await store.findCode(guildId, normalized);
    if (!code) return { decision: "not-found", code: null };
    if (!code.active) return { decision: "inactive", code };
    if (code.ownerId === discordId) return { decision: "own-code", code };

    await store.setUse(guildId, discordId, code.id, now);
    return { decision: "applied", code };
}
