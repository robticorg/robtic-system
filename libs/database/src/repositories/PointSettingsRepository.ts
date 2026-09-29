import { PointSettings, type IPointSettings } from "@database/models/PointSettings";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { settings: IPointSettings; expiresAt: number }>();

export class PointSettingsRepository {
    /** Read on every award, so cached with the usual short TTL. */
    static async getCached(guildId: string): Promise<IPointSettings> {
        const hit = cache.get(guildId);
        if (hit && hit.expiresAt > Date.now()) return hit.settings;

        const settings = await PointSettings.findOneAndUpdate(
            { guildId },
            { $setOnInsert: { guildId } },
            { upsert: true, returnDocument: "after" }
        ) as IPointSettings;

        cache.set(guildId, { settings, expiresAt: Date.now() + CACHE_TTL_MS });
        return settings;
    }

    static invalidate(guildId: string): void {
        cache.delete(guildId);
    }
}
