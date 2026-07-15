import type { ICombo, IComboServerRecords } from "@database/models";
import { ComboServerRecordsRepository } from "@database/repositories";
import { Logger } from "@core/libs";

const CTX = "main:combo-records";

/**
 * In-memory cache of each guild's server-records document. Record-breaking is rare relative to
 * message volume, so caching avoids a DB read on every message just to compare against the current
 * record — a write only happens when a record is actually broken.
 */
const recordCache = new Map<string, IComboServerRecords>();

async function getCached(guildId: string): Promise<IComboServerRecords> {
    let doc = recordCache.get(guildId);
    if (!doc) {
        doc = await ComboServerRecordsRepository.getOrCreate(guildId);
        recordCache.set(guildId, doc);
    }
    return doc;
}

/** Checks records that can be broken mid-conversation (score, heat) — called on every qualifying message; cheap in the common case. */
export async function checkLiveRecords(guildId: string, pair: ICombo, userAId: string, userBId: string): Promise<void> {
    try {
        const doc = await getCached(guildId);
        let dirty = false;

        if (pair.currentScore > (doc.highestComboEver?.value ?? 0)) {
            doc.highestComboEver = { value: pair.currentScore, userAId, userBId, achievedAt: new Date() };
            dirty = true;
        }
        if (pair.heat > (doc.highestHeat?.value ?? 0)) {
            doc.highestHeat = { value: pair.heat, userAId, userBId, achievedAt: new Date() };
            dirty = true;
        }

        if (dirty) await ComboServerRecordsRepository.save(doc);
    } catch (err) {
        Logger.warn(`Failed to check live combo records for guild ${guildId}: ${err}`, CTX);
    }
}

/** Checks records that only finalize when a conversation ends (duration, messages, streak). */
export async function checkFinalRecords(
    guildId: string,
    pair: ICombo,
    userAId: string,
    userBId: string,
    streakCurrent: number,
): Promise<void> {
    try {
        const doc = await getCached(guildId);
        let dirty = false;

        if (pair.totalDurationMs > (doc.longestConversation?.value ?? 0)) {
            doc.longestConversation = { value: pair.totalDurationMs, userAId, userBId, achievedAt: new Date() };
            dirty = true;
        }
        if (pair.messages > (doc.mostMessages?.value ?? 0)) {
            doc.mostMessages = { value: pair.messages, userAId, userBId, achievedAt: new Date() };
            dirty = true;
        }
        if (streakCurrent > (doc.longestConversationStreak?.value ?? 0)) {
            doc.longestConversationStreak = { value: streakCurrent, userAId, userBId, achievedAt: new Date() };
            dirty = true;
        }

        if (dirty) await ComboServerRecordsRepository.save(doc);
    } catch (err) {
        Logger.warn(`Failed to check final combo records for guild ${guildId}: ${err}`, CTX);
    }
}

export async function getServerRecords(guildId: string): Promise<IComboServerRecords> {
    return getCached(guildId);
}
