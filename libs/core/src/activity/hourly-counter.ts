import { GuildHourlyStatRepository } from "@database/repositories";
import { utcDateKey } from "@utils";
import { Logger } from "@logger";

/**
 * Messages per server per hour, for the `/top` chart. Counted in memory and written every FLUSH_MS as one $inc per
 * server and day, so a busy server costs a few writes a minute rather than one per message. A crash loses at most the
 * last few seconds, which a chart can afford.
 */
const FLUSH_MS = 30_000;

/** `guildId|day` → hour → count. */
const pending = new Map<string, Map<number, number>>();
let timer: ReturnType<typeof setInterval> | null = null;

export function countHourlyMessage(guildId: string, at: Date = new Date()): void {
    const key = `${guildId}|${utcDateKey(at)}`;
    let hours = pending.get(key);
    if (!hours) pending.set(key, (hours = new Map()));
    const hour = at.getUTCHours();
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
    timer ??= setInterval(() => void flushHourlyMessages(), FLUSH_MS);
    timer.unref?.();
}

export async function flushHourlyMessages(): Promise<void> {
    const batch = [...pending];
    pending.clear();
    for (const [key, hours] of batch) {
        const [guildId, day] = key.split("|") as [string, string];
        try {
            await GuildHourlyStatRepository.add(guildId, day, hours);
        } catch (err) {
            Logger.warn(`Hourly message counts not saved for ${guildId}: ${(err as Error).message}`, "hourly-counter");
        }
    }
}
