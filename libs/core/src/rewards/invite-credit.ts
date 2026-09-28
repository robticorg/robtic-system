import { RewardInviteCreditRepository } from "@database/repositories";
import { REWARD_INVITE_BONUS } from "@constants";

/**
 * Invite bonus: +1% per active invite credit, at most `maxActiveSlots` of them.
 *
 * A credit is one inviter/invitee relationship, created at most once per invitee per guild — ever
 * (the unique index on `RewardInviteCredit`). It is *active* while it has not expired (each one
 * lasts `inviteDurationDays` from its own join, independently of every other) and the invitee is
 * still in the guild. Validity is always computed at read time (`expiresAt > now`), so correctness
 * never depends on a cleanup job; expired rows are kept on purpose, as the record that stops the
 * same member being credited twice.
 *
 * Working out *which* invite a member joined through is discord.js work, done in
 * `apps/bot/src/features/invites/invites.event.ts`; it hands this module plain
 * snapshots, and `detectUsedInvite` below makes the actual decision.
 */

const DAY_MS = 86_400_000;

/** A credit expires exactly `inviteDurationDays` after that invitee joined. */
export function inviteExpiresAt(joinedAt: Date): Date {
    return new Date(joinedAt.getTime() + REWARD_INVITE_BONUS.inviteDurationDays * DAY_MS);
}

/** Active = not yet expired, and the invitee has not left. Expiry is exclusive: at `expiresAt` it no longer counts. */
export function isInviteCreditActive(credit: { expiresAt: Date; leftAt?: Date | null }, now: Date): boolean {
    return credit.expiresAt.getTime() > now.getTime() && !credit.leftAt;
}

export function countActiveInviteCredits(credits: ReadonlyArray<{ expiresAt: Date; leftAt?: Date | null }>, now: Date): number {
    return credits.filter(credit => isInviteCreditActive(credit, now)).length;
}

export type InviteCreditDecision =
    | "credit"
    /** No attributable inviter — vanity URL, widget, ambiguous detection, or a bot inviter. */
    | "no-inviter"
    | "self-invite"
    /** This member was credited before (to anyone): a rejoin, or a duplicate join event. */
    | "already-credited"
    /** The inviter already holds every slot; the member is not credited and not burned. */
    | "slots-full";

export function decideInviteCredit(input: {
    inviterId: string | null;
    inviteeId: string;
    alreadyCredited: boolean;
    inviterActiveCredits: number;
}): InviteCreditDecision {
    if (!input.inviterId) return "no-inviter";
    if (input.inviterId === input.inviteeId) return "self-invite";
    if (input.alreadyCredited) return "already-credited";
    if (input.inviterActiveCredits >= REWARD_INVITE_BONUS.maxActiveSlots) return "slots-full";
    return "credit";
}

/** One invite's use counter as fetched from Discord. `maxUses` 0 = unlimited. */
export interface InviteUseSnapshot {
    code: string;
    uses: number;
    maxUses: number;
    inviterId: string | null;
    /** The guild's vanity URL — never has an inviter, so it is never credited. */
    vanity?: boolean;
}

/**
 * Which invite a member just joined through, from the guild's invite list before and after.
 *
 * Exactly one invite whose use count went up (an invite created since `before` counts from 0) is
 * the answer. With none, an invite that vanished one use short of its `maxUses` — Discord deletes
 * an invite the moment it is used up — is the answer. Anything else (several candidates, or none)
 * is ambiguous and returns `null`: no credit is better than crediting the wrong inviter.
 */
export function detectUsedInvite(
    before: ReadonlyMap<string, InviteUseSnapshot>,
    after: ReadonlyMap<string, InviteUseSnapshot>,
): InviteUseSnapshot | null {
    const increased = [...after.values()].filter(invite => invite.uses > (before.get(invite.code)?.uses ?? 0));
    if (increased.length === 1) return increased[0]!;
    if (increased.length > 1) return null;

    const usedUp = [...before.values()].filter(
        invite => !after.has(invite.code) && invite.maxUses > 0 && invite.uses + 1 >= invite.maxUses,
    );
    return usedUp.length === 1 ? usedUp[0]! : null;
}

// ---------------------------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------------------------

/** The persistence `recordInviteeJoin`/`recordInviteeLeave` need — `RewardInviteCreditRepository` in production. */
export interface InviteCreditStore {
    credit(guildId: string, inviterId: string, inviteeId: string, inviteCode: string, joinedAt: Date, expiresAt: Date): Promise<boolean>;
    countActive(guildId: string, inviterId: string, now: Date): Promise<number>;
    markLeft(guildId: string, inviteeId: string, at: Date): Promise<void>;
    markRejoined(guildId: string, inviteeId: string): Promise<boolean>;
}

/**
 * A member joined `guildId`, through `inviterId`'s invite if one could be attributed. Never awards
 * anything directly — it only records the relationship the reward calculator later counts.
 *
 * A member with an existing credit (a rejoin) is never credited again: their original credit is
 * reactivated instead, under its original expiry. The unique index backs this up against two join
 * events racing past the check.
 */
export async function recordInviteeJoin(
    guildId: string,
    inviteeId: string,
    invite: { code: string; inviterId: string | null } | null,
    joinedAt: Date = new Date(),
    store: InviteCreditStore = RewardInviteCreditRepository,
): Promise<InviteCreditDecision> {
    const alreadyCredited = await store.markRejoined(guildId, inviteeId);
    const inviterId = invite?.inviterId ?? null;

    const decision = decideInviteCredit({
        inviterId,
        inviteeId,
        alreadyCredited,
        inviterActiveCredits: inviterId && !alreadyCredited ? await store.countActive(guildId, inviterId, joinedAt) : 0,
    });
    if (decision !== "credit") return decision;

    const created = await store.credit(guildId, inviterId!, inviteeId, invite!.code, joinedAt, inviteExpiresAt(joinedAt));
    return created ? "credit" : "already-credited";
}

/** A member left: their credit (if any) stops counting, but is kept so a rejoin cannot mint another. */
export async function recordInviteeLeave(
    guildId: string,
    inviteeId: string,
    at: Date = new Date(),
    store: InviteCreditStore = RewardInviteCreditRepository,
): Promise<void> {
    await store.markLeft(guildId, inviteeId, at);
}

/**
 * Currently active invite count for one inviter — feeds `activeInviteSlots` in
 * `resolveRewardBonuses`. Computed at read time, per credit, never on a shared reset.
 */
export async function getActiveInviteCount(guildId: string, discordId: string, now: Date = new Date()): Promise<number> {
    return RewardInviteCreditRepository.countActive(guildId, discordId, now);
}
