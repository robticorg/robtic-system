import { AutoReply, type IAutoReplyDoc } from "@database/models/AutoReply";

/** Rules change from the dashboard; it promises "within a minute", so 30 s keeps that with room to spare. */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { rules: IAutoReplyDoc[]; expiresAt: number }>();

export class AutoReplyRepository {
    /**
     * A guild's enabled rules, in the order they're checked (priority, then their place in the dashboard list).
     *
     * Read on every message, so cached: a server with no rules costs one query per 30 s, not one per message.
     */
    static async listCached(guildId: string): Promise<IAutoReplyDoc[]> {
        const hit = cache.get(guildId);
        if (hit && hit.expiresAt > Date.now()) return hit.rules;

        const rules = await AutoReply.find({ guildId, enabled: true }).sort({ priority: 1, position: 1 }).lean<IAutoReplyDoc[]>();
        cache.set(guildId, { rules, expiresAt: Date.now() + CACHE_TTL_MS });
        return rules;
    }

    /** Counts a reply for the dashboard's usage numbers. Fire-and-forget: a lost count must never block a reply. */
    static recordUse(guildId: string, ruleId: string): void {
        void AutoReply.updateOne({ guildId, ruleId }, { $inc: { uses: 1 }, $set: { lastUsedAt: new Date() } }).catch(() => null);
    }

    static clearCache(guildId?: string): void {
        if (guildId) cache.delete(guildId);
        else cache.clear();
    }
}
