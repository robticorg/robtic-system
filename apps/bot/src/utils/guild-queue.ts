/**
 * Runs tasks for the same guild one at a time, in arrival order; different guilds never wait on
 * each other.
 *
 * Invite attribution needs it because two members joining together would otherwise diff against the
 * same "before" snapshot and both see both uses; booster tracking needs it so a boost announcement
 * cannot interleave with a guild-wide resync. A failed task is logged by its caller and does not
 * stall the queue.
 */
export function createGuildQueue() {
    const tails = new Map<string, Promise<void>>();

    return function enqueue(guildId: string, task: () => Promise<void>): Promise<void> {
        const run = (tails.get(guildId) ?? Promise.resolve()).then(task);
        const tail = run.catch(() => undefined);
        tails.set(guildId, tail);
        void tail.then(() => {
            if (tails.get(guildId) === tail) tails.delete(guildId);
        });
        return run;
    };
}
