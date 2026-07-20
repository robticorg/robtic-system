import type { Guild, Message } from "discord.js";
import type { ICombo } from "@database/models";
import { ComboRepository, ComboUserStatsRepository, ComboSettingsRepository, PunishmentRepository } from "@database/repositories";
import { COMBO_CONFIG } from "@core/config";
import { Logger } from "@core/libs";
import { isAcceptableMessage } from "@core/utils";
import { detectConversationPartner, type ActivePartnerInfo } from "./combo-conversation-detector";
import { classifyComboMessage } from "./combo-spam-guard";
import { computeHeat } from "./combo-heat";
import { checkLiveRecords, checkFinalRecords } from "./combo-record-service";
import { recordEndedCombo } from "./combo-history-service";
import { recordFavoritePartnerScore } from "./combo-leaderboard-service";
import { rollConversationStreak } from "./combo-streak-service";

const CTX = "main:combo";

/**
 * Self-populating in-memory cache of each user's current highest-active-combo partner, keyed by
 * `guildId:userId`. Populated as a side effect of every processed message so the detector's
 * "continuity" signal never needs a DB read on the hot path; entries simply expire after the combo
 * expiry window.
 */
const activePartnerCache = new Map<string, { partnerId: string; score: number; expiresAt: number }>();

function cacheKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

function getCachedPartner(guildId: string, userId: string): ActivePartnerInfo | null {
    const entry = activePartnerCache.get(cacheKey(guildId, userId));
    if (!entry || entry.expiresAt < Date.now()) return null;
    return { partnerId: entry.partnerId, score: entry.score };
}

function cachePartners(guildId: string, userAId: string, userBId: string, score: number): void {
    const expiresAt = Date.now() + COMBO_CONFIG.expireMs;
    activePartnerCache.set(cacheKey(guildId, userAId), { partnerId: userBId, score, expiresAt });
    activePartnerCache.set(cacheKey(guildId, userBId), { partnerId: userAId, score, expiresAt });
}

/**
 * Spam-tier last activity expires on the short clock; a genuine message keeps the normal window.
 * Checked per-participant (not just the pair's overall last message) so a combo ends the moment
 * EITHER side goes quiet for the expiry window — one person spamming alone must not keep a combo
 * alive while the other side is being ignored. Exported so the scheduler's sweep
 * (finalizeExpiredCombos) uses the exact same rule as the hot path.
 */
export function isStale(pair: ICombo, now: number): boolean {
    if (pair.status === "ended") return true;
    const expiry = pair.lastMessageQuality === "spammy" ? COMBO_CONFIG.spamExpireMs : COMBO_CONFIG.expireMs;
    // Fall back to the shared timestamp for pairs written before per-participant tracking existed;
    // the next message from either side repopulates both fields going forward.
    const lowTimestamp = pair.lastMessageAtLow ?? pair.lastMessageAt;
    const highTimestamp = pair.lastMessageAtHigh ?? pair.lastMessageAt;
    const lowSilentMs = now - lowTimestamp.getTime();
    const highSilentMs = now - highTimestamp.getTime();
    return lowSilentMs > expiry || highSilentMs > expiry;
}

interface ScoreRange {
    min: number;
    max: number;
}

/** Short-TTL cache so the per-guild-configurable score range doesn't cost a Mongo read on every message. */
const SCORE_RANGE_CACHE_TTL_MS = 60_000;
const scoreRangeCache = new Map<string, { range: ScoreRange; expiresAt: number }>();

async function getScoreRange(guildId: string): Promise<ScoreRange> {
    const cached = scoreRangeCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.range;

    const settings = await ComboSettingsRepository.get(guildId);
    const range: ScoreRange = {
        min: settings?.minScorePerMessage ?? COMBO_CONFIG.minScorePerMessage,
        max: settings?.maxScorePerMessage ?? COMBO_CONFIG.maxScorePerMessage,
    };
    scoreRangeCache.set(guildId, { range, expiresAt: Date.now() + SCORE_RANGE_CACHE_TTL_MS });
    return range;
}

/** Called after an admin updates the per-guild score range so the new values take effect immediately. */
export function invalidateScoreRangeCache(guildId: string): void {
    scoreRangeCache.delete(guildId);
}

/**
 * Archives an ended conversation: rolls the conversation streak forward, writes history, updates
 * both participants' aggregate stats, and checks server records/leaderboard entries that only
 * finalize at combo-end. Idempotent — safe to call from both the lazy per-message path and the
 * periodic scheduler without double-processing (guarded by pair.status).
 */
export async function finalizeCombo(pair: ICombo): Promise<void> {
    if (pair.status === "ended") return;

    const now = new Date();
    const userAId = pair.userLowId;
    const userBId = pair.userHighId;

    // A pair that never actually exchanged a qualifying message shouldn't count as a conversation day.
    const roll = pair.messages > 0
        ? rollConversationStreak(pair.streakCurrent, pair.streakBest, pair.lastStreakDateKey, now)
        : { streakCurrent: pair.streakCurrent, streakBest: pair.streakBest, dateKey: pair.lastStreakDateKey };
    const { streakCurrent, streakBest, dateKey } = roll;

    await ComboRepository.endWithStreak(pair.guildId, userAId, userBId, streakCurrent, streakBest, dateKey);

    if (pair.messages === 0) return;

    try {
        await recordEndedCombo(pair, now);
        await ComboUserStatsRepository.applyComboEnd(pair.guildId, userAId, userBId, {
            score: pair.currentScore,
            durationMs: pair.totalDurationMs,
            messages: pair.messages,
            streakCurrent,
        });
        await checkFinalRecords(pair.guildId, pair, userAId, userBId, streakCurrent);
        await recordFavoritePartnerScore(pair.guildId, userAId, userBId);
    } catch (err) {
        Logger.error(`Failed to finalize combo ${pair.guildId}:${userAId}:${userBId}: ${err}`, CTX);
    }
}

export async function processComboMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot || message.webhookId) return;

    const guildId = message.guild.id;
    const authorId = message.author.id;
    const now = message.createdTimestamp || Date.now();

    const detection = detectConversationPartner(message, (userId) => getCachedPartner(guildId, userId));
    if (!detection || detection.partnerId === authorId) return;

    const { partnerId, confidence } = detection;

    let pair = await ComboRepository.findOrCreate(guildId, authorId, partnerId);

    if (isStale(pair, now)) {
        await finalizeCombo(pair);
        const restarted = await ComboRepository.restart(guildId, authorId, partnerId, new Date(now));
        if (!restarted) return;
        pair = restarted;
    }

    const content = message.content.trim();
    if (!isAcceptableMessage(content, COMBO_CONFIG.minMessageLength)) {
        // Presence still counts for alternation/continuity, but low-quality messages earn no score.
        cachePartners(guildId, authorId, partnerId, pair.currentScore);
        return;
    }

    const quality = classifyComboMessage(guildId, authorId, content, now);
    if (quality === "ignored") {
        // Repeated spam — doesn't touch the combo's state at all, not even the expiry clock.
        cachePartners(guildId, authorId, partnerId, pair.currentScore);
        return;
    }

    const elapsedSinceLast = pair.messages === 0 ? 0 : now - pair.lastMessageAt.getTime();
    const alternating = pair.lastMessageBy !== "" && pair.lastMessageBy !== authorId;
    const heat = computeHeat(pair.heat, elapsedSinceLast, alternating, confidence);
    const { min: minScore, max: maxScore } = await getScoreRange(guildId);
    let scoreGain = Math.round(minScore + (maxScore - minScore) * confidence);

    // Single-word / repeated messages still count, but contribute sharply less score.
    if (quality === "spammy") {
        scoreGain = Math.max(0, Math.round(scoreGain * COMBO_CONFIG.spamScoreMultiplier));
    }

    // A high punishment level makes it harder (not impossible) for that user to grow shared combo score.
    const punishmentLevel = await PunishmentRepository.getPunishmentLevel(authorId);
    if (punishmentLevel >= COMBO_CONFIG.punishmentGateThreshold) {
        scoreGain = Math.max(1, Math.round(scoreGain * COMBO_CONFIG.punishmentGateMultiplier));
    }

    const durationDelta = Math.min(elapsedSinceLast, COMBO_CONFIG.expireMs);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const characterCount = content.length;

    const updated = await ComboRepository.applyMessage(
        guildId, authorId, partnerId, authorId, scoreGain, heat, durationDelta, wordCount, characterCount, new Date(now), quality,
    );
    if (!updated) return;

    cachePartners(guildId, authorId, partnerId, updated.currentScore);
    await checkLiveRecords(guildId, updated, updated.userLowId, updated.userHighId);
}

export async function getUserHighestCombo(guildId: string, userId: string): Promise<{ pair: ICombo; partnerId: string } | null> {
    const pairs = await ComboRepository.findActiveForUser(guildId, userId);
    if (pairs.length === 0) return null;

    const best = pairs.reduce((a, b) => (a.currentScore >= b.currentScore ? a : b));
    const partnerId = best.userLowId === userId ? best.userHighId : best.userLowId;
    return { pair: best, partnerId };
}

/** Guild-wide rank of a user's highest active combo score. Returns -1 if the user has no active combo. */
export async function getUserComboRank(guildId: string, userId: string): Promise<number> {
    const active = await ComboRepository.findAllActive(guildId);
    const scoreByUser = new Map<string, number>();

    for (const pair of active) {
        scoreByUser.set(pair.userLowId, Math.max(scoreByUser.get(pair.userLowId) ?? 0, pair.currentScore));
        scoreByUser.set(pair.userHighId, Math.max(scoreByUser.get(pair.userHighId) ?? 0, pair.currentScore));
    }

    const myScore = scoreByUser.get(userId);
    if (myScore === undefined || myScore <= 0) return -1;

    let above = 0;
    for (const score of scoreByUser.values()) {
        if (score > myScore) above++;
    }
    return above + 1;
}

export async function finalizeExpiredCombos(guild: Guild): Promise<ICombo[]> {
    const now = Date.now();
    const active = await ComboRepository.findAllActive(guild.id);
    const stillActive: ICombo[] = [];

    for (const pair of active) {
        if (isStale(pair, now)) {
            await finalizeCombo(pair);
        } else {
            stillActive.push(pair);
        }
    }

    return stillActive;
}
