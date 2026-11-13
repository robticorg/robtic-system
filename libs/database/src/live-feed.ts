import mongoose from "mongoose";

// The dashboard's live numbers. Each process adds up what it sees per server (messages, people joining and leaving
// voice, members joining and leaving, voice time) and every couple of seconds writes one small row per busy server into
// a capped collection. The dashboard's backend tails that collection and pushes each server's rows to its open
// dashboards, which count the numbers up as they arrive.
//
// Cheap by design: bumping is a Map update (it's on the message path), nothing is written for a quiet server, and the
// collection is capped, so it never grows. If the database is down the counts are dropped: they're only the live
// effect, the real numbers are stored elsewhere as before.

export type LiveKind = "messages" | "voiceJoin" | "voiceLeave" | "memberJoin" | "memberLeave" | "voiceSeconds";

export const LIVE_COLLECTION = "dashboardlive";
const FLUSH_MS = 2_000;
const CAPPED_BYTES = 16 * 1024 * 1024;

const pending = new Map<string, Partial<Record<LiveKind, number>>>();
let timer: ReturnType<typeof setInterval> | null = null;
let ready: Promise<unknown> | null = null;

/** Adds `n` to a server's live count. Synchronous and never throws. */
export function liveBump(guildId: string, kind: LiveKind, n = 1): void {
    if (!guildId || !n) return;
    const counts = pending.get(guildId) ?? {};
    counts[kind] = (counts[kind] ?? 0) + n;
    pending.set(guildId, counts);
    timer ??= startFlushing();
}

function startFlushing(): ReturnType<typeof setInterval> {
    const t = setInterval(() => void flush(), FLUSH_MS);
    t.unref?.();
    return t;
}

async function flush(): Promise<void> {
    if (!pending.size || mongoose.connection.readyState !== 1) return;
    const at = new Date();
    const rows = [...pending].map(([guildId, counts]) => ({ guildId, at, counts }));
    pending.clear();
    try {
        const db = mongoose.connection.db!;
        ready ??= db.createCollection(LIVE_COLLECTION, { capped: true, size: CAPPED_BYTES }).catch(() => null); // already there
        await ready;
        await db.collection(LIVE_COLLECTION).insertMany(rows, { ordered: false });
    } catch {
        // Only the live effect is lost.
    }
}
