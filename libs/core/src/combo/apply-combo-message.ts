import type { ICombo } from "@database/models";
import { ComboRepository, PointsRepository, PunishmentRepository } from "@database/repositories";
import { COMBO_CONFIG } from "@constants";
import { getPointRates } from "../points/get-point-rates";
import { computeHeat } from "./compute-heat";
import { finalizeCombo } from "./finalize-combo";
import { isStale } from "./is-stale";
import { checkLiveRecords } from "./records";
import { getScoreRange } from "./score-range-cache";

/**
 * One conversational message applied to its pair's combo. The Gateway detects the partner (that
 * needs its in-memory view of each channel) and measures the message; everything here is MongoDB,
 * so it runs in the worker — or inline when there is no Redis.
 *
 * Safe to retry: the message is applied at most once (the pair remembers recent message ids),
 * Points go through `addProgressOnce`, records only ever rise, and a stale pair is archived by
 * exactly one caller. Every time is the message's own, so a retry decides exactly as the first try.
 */

export interface ComboMessageInput {
    guildId: string;
    authorId: string;
    partnerId: string;
    username: string;
    messageId: string;
    /** Detection confidence, 0–1. */
    confidence: number;
    at: Date;
    /** Long enough to score. A shorter message still keeps the conversation alive (and can end a stale one). */
    countable: boolean;
    wordCount: number;
    characterCount: number;
}

export interface ComboStore {
    findOrCreate(guildId: string, a: string, b: string): Promise<ICombo>;
    finalize(pair: ICombo): Promise<void>;
    restart(guildId: string, a: string, b: string, at: Date): Promise<ICombo | null>;
    applyMessage(input: ComboMessageInput, scoreGain: number, heat: number, durationDeltaMs: number): Promise<ICombo | null>;
    scoreRange(guildId: string): Promise<{ min: number; max: number }>;
    punishmentLevel(userId: string): Promise<number>;
    addPoints(input: ComboMessageInput, scoreGain: number): Promise<number>;
    liveRecords(guildId: string, pair: ICombo): Promise<void>;
}

export const repositoryComboStore: ComboStore = {
    findOrCreate: (g, a, b) => ComboRepository.findOrCreate(g, a, b),
    finalize: pair => finalizeCombo(pair),
    restart: (g, a, b, at) => ComboRepository.restart(g, a, b, at),
    applyMessage: (i, scoreGain, heat, durationDeltaMs) => ComboRepository.applyMessage(
        i.guildId, i.authorId, i.partnerId, i.authorId, scoreGain, heat, durationDeltaMs, i.wordCount, i.characterCount, i.at, i.messageId,
    ),
    scoreRange: g => getScoreRange(g),
    punishmentLevel: u => PunishmentRepository.getPunishmentLevel(u),
    addPoints: async (i, scoreGain) => {
        const { comboPerPoint } = await getPointRates(i.guildId);
        return PointsRepository.addProgressOnce(i.guildId, i.authorId, i.username, "combo", scoreGain, comboPerPoint, `combo-${i.messageId}`);
    },
    liveRecords: (g, pair) => checkLiveRecords(g, pair, pair.userLowId, pair.userHighId),
};

export type ComboMessageOutcome =
    | { status: "applied" | "duplicate"; score: number; scoreGain: number; points: number }
    | { status: "not-counted"; score: number }
    /** The pair could not be restarted (vanished mid-way) — nothing to do. */
    | { status: "gone" };

export async function applyComboMessage(
    input: ComboMessageInput,
    deps: {
        store?: ComboStore;
        /** Keeps the detector's "who is each member talking to" view current. */
        cachePartners: (guildId: string, a: string, b: string, score: number) => Promise<void> | void;
    },
): Promise<ComboMessageOutcome> {
    const store = deps.store ?? repositoryComboStore;
    const { guildId, authorId, partnerId } = input;
    const now = input.at.getTime();

    let pair = await store.findOrCreate(guildId, authorId, partnerId);
    const alreadyApplied = pair.appliedMessages?.includes(input.messageId) ?? false;

    if (!alreadyApplied && isStale(pair, now)) {
        await store.finalize(pair);
        const restarted = await store.restart(guildId, authorId, partnerId, input.at);
        if (!restarted) return { status: "gone" };
        pair = restarted;
    }

    if (!input.countable) {
        await deps.cachePartners(guildId, authorId, partnerId, pair.currentScore);
        return { status: "not-counted", score: pair.currentScore };
    }

    const elapsedSinceLast = pair.messages === 0 ? 0 : Math.max(0, now - pair.lastMessageAt.getTime());
    const alternating = pair.lastMessageBy !== "" && pair.lastMessageBy !== authorId;
    const heat = computeHeat(pair.heat, elapsedSinceLast, alternating, input.confidence);
    const { min, max } = await store.scoreRange(guildId);
    let scoreGain = Math.round(min + (max - min) * input.confidence);

    if ((await store.punishmentLevel(authorId)) >= COMBO_CONFIG.punishmentGateThreshold) {
        scoreGain = Math.max(1, Math.round(scoreGain * COMBO_CONFIG.punishmentGateMultiplier));
    }

    const durationDelta = Math.min(elapsedSinceLast, COMBO_CONFIG.expireMs);
    const updated = alreadyApplied ? null : await store.applyMessage(input, scoreGain, heat, durationDelta);

    if (!updated) {
        // Applied by an earlier attempt: only finish what that attempt may not have (Points are keyed by message).
        const points = await store.addPoints(input, scoreGain);
        return { status: "duplicate", score: pair.currentScore, scoreGain, points };
    }

    await deps.cachePartners(guildId, authorId, partnerId, updated.currentScore);
    const points = await store.addPoints(input, scoreGain);
    await store.liveRecords(guildId, updated);

    return { status: "applied", score: updated.currentScore, scoreGain, points };
}
