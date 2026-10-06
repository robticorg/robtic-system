import type { ICombo, IComboServerRecords } from "@database/models";
import { ComboServerRecordsRepository, type ComboRecordField } from "@database/repositories";
import { Logger } from "@logger";

const CTX = "combo-records";

/**
 * Server records (highest combo, hottest conversation, …). Two processes break records — the
 * worker on messages, the Gateway's scheduler when combos end — so the decision is MongoDB's: a
 * record is only written if it still beats the stored one (`ComboServerRecordsRepository.raise`).
 *
 * The cache only saves reads: a value at or below the cached record can't be a record, so most
 * messages never touch MongoDB. It expires quickly so displays (`/combo records`) pick up records
 * set by the other process.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { doc: IComboServerRecords; expiresAt: number }>();

async function cachedRecords(guildId: string): Promise<IComboServerRecords> {
    const hit = cache.get(guildId);
    if (hit && hit.expiresAt > Date.now()) return hit.doc;
    const doc = await ComboServerRecordsRepository.getOrCreate(guildId);
    cache.set(guildId, { doc, expiresAt: Date.now() + CACHE_TTL_MS });
    return doc;
}

export async function getServerRecords(guildId: string): Promise<IComboServerRecords> {
    return cachedRecords(guildId);
}

async function raiseIfHigher(guildId: string, field: ComboRecordField, value: number, userAId: string, userBId: string): Promise<void> {
    const doc = await cachedRecords(guildId);
    if (value <= (doc[field]?.value ?? 0)) return;

    const entry = { value, userAId, userBId, achievedAt: new Date() };
    if (await ComboServerRecordsRepository.raise(guildId, field, entry)) {
        doc[field] = entry;
    } else {
        cache.delete(guildId); // someone else holds a higher record — re-read next time
    }
}

/** Records that can be broken mid-conversation (score, heat) — checked on every qualifying message. */
export async function checkLiveRecords(guildId: string, pair: ICombo, userAId: string, userBId: string): Promise<void> {
    try {
        await raiseIfHigher(guildId, "highestComboEver", pair.currentScore, userAId, userBId);
        await raiseIfHigher(guildId, "highestHeat", pair.heat, userAId, userBId);
    } catch (err) {
        Logger.warn(`Failed to check live combo records for guild ${guildId}: ${err}`, CTX);
    }
}

/** Records that only finalize when a conversation ends (duration, messages, streak). */
export async function checkFinalRecords(guildId: string, pair: ICombo, userAId: string, userBId: string, streakCurrent: number): Promise<void> {
    try {
        await raiseIfHigher(guildId, "longestConversation", pair.totalDurationMs, userAId, userBId);
        await raiseIfHigher(guildId, "mostMessages", pair.messages, userAId, userBId);
        await raiseIfHigher(guildId, "longestConversationStreak", streakCurrent, userAId, userBId);
    } catch (err) {
        Logger.warn(`Failed to check final combo records for guild ${guildId}: ${err}`, CTX);
    }
}
