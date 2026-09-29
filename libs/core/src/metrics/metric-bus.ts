import { Logger } from "@logger";

const CTX = "metrics";

/**
 * Everything a member can make progress on.
 *
 * Open-ended by design: a new system adds a name here and starts publishing, and nothing that
 * listens has to change. The two halves of this union behave very differently — see `accumulation`.
 */
export type QuestMetric =
    | "messages"
    | "xp"
    | "voiceTime"
    | "voiceXp"
    | "comboScore"
    | "comboHeat"
    | "streak"
    | "pointsEarned"
    | "levelUp"
    | "communityContribution";

export interface MetricEvent {
    guildId: string;
    discordId: string;
    username: string;
    metric: QuestMetric;
    /** A delta for `sum` metrics, the new absolute value for `max` metrics. */
    value: number;
    /** When the underlying thing happened, for ordering. Defaults to now. */
    at?: number;
}

type MetricListener = (event: MetricEvent) => void;

const listeners = new Set<MetricListener>();

/**
 * Announces that a member's metric moved.
 *
 * **Synchronous and it never throws.** This is called from the message path for every message in
 * every guild, so it cannot return a promise — an `await` here would put a microtask (and the
 * temptation of a DB read) between a member typing and the bot responding. Listeners are expected
 * to do nothing but update memory; anything slower belongs on their own timer.
 *
 * A listener that throws is logged and skipped. One broken consumer must not stop the others, and
 * must never break the producer, which is usually mid-way through awarding something.
 */
export function publishMetric(event: MetricEvent): void {
    if (listeners.size === 0) return;

    for (const listener of listeners) {
        try {
            listener(event);
        } catch (err) {
            Logger.warn(`Metric listener failed for ${event.metric}: ${err}`, CTX);
        }
    }
}

/** Drops every listener. Used by the module loader's reload path, so handlers aren't bound twice. */
export function clearMetricListeners(): void {
    listeners.clear();
}
