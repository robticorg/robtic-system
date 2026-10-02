type Timer = ReturnType<typeof setTimeout>;

export interface BatchTimers {
    setTimeout: (fn: () => void, ms: number) => Timer;
    clearTimeout: (timer: Timer) => void;
}

/**
 * Collects members per guild and flushes each guild's batch once `quietMs` passes with nothing
 * added. Every `add` restarts that guild's wait. A Set per guild, so a member added twice is
 * flushed once. Timers are injectable so the rule can be tested without waiting 30 minutes.
 */
export function createBoostBatcher<G>(
    quietMs: number,
    onFlush: (guild: G, memberIds: string[]) => void,
    timers: BatchTimers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: t => clearTimeout(t) },
) {
    const batches = new Map<string, { guild: G; memberIds: Set<string>; timer: Timer }>();

    return {
        add(guildId: string, guild: G, memberId: string): void {
            const batch = batches.get(guildId);
            if (batch) timers.clearTimeout(batch.timer);

            const memberIds = batch?.memberIds ?? new Set<string>();
            memberIds.add(memberId);

            const timer = timers.setTimeout(() => {
                batches.delete(guildId);
                onFlush(guild, [...memberIds]);
            }, quietMs);

            batches.set(guildId, { guild, memberIds, timer });
        },
        /** Members currently waiting in a guild's batch — for tests and diagnostics. */
        pending(guildId: string): string[] {
            return [...(batches.get(guildId)?.memberIds ?? [])];
        },
    };
}
