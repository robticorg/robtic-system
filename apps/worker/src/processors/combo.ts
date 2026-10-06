import { UnrecoverableError } from "bullmq";
import { applyComboMessage, type ComboMessageOutcome } from "@core/combo";
import type { ComboMessageJob } from "@queue";

/**
 * The `combo` queue: one conversational message applied to its pair (`@core/combo`). The queue
 * runs one job at a time, so a pair's messages apply in order; retries are safe (see
 * `applyComboMessage`). The partner cache goes to Redis so the Gateway's detector sees it.
 */

export interface ComboProcessorDeps {
    apply: typeof applyComboMessage;
    cachePartners: (guildId: string, a: string, b: string, score: number) => Promise<void>;
}

const SNOWFLAKE = /^\d{17,20}$/;

function validate(job: ComboMessageJob): void {
    if (job?.kind !== "combo-message") throw new UnrecoverableError("unknown combo job kind");
    if (![job.guildId, job.authorId, job.partnerId, job.messageId].every(id => SNOWFLAKE.test(id))) {
        throw new UnrecoverableError("invalid guild, member or message id");
    }
    if (job.authorId === job.partnerId) throw new UnrecoverableError("a member can't combo with themselves");
    if (!(job.confidence >= 0 && job.confidence <= 1)) throw new UnrecoverableError("invalid confidence");
    if (!Number.isFinite(Date.parse(job.at))) throw new UnrecoverableError("invalid timestamp");
}

export async function processComboJob(job: ComboMessageJob, deps: ComboProcessorDeps): Promise<ComboMessageOutcome> {
    validate(job);
    return deps.apply(
        {
            guildId: job.guildId,
            authorId: job.authorId,
            partnerId: job.partnerId,
            username: job.username,
            messageId: job.messageId,
            confidence: job.confidence,
            at: new Date(job.at),
            countable: job.countable,
            wordCount: job.wordCount,
            characterCount: job.characterCount,
        },
        { cachePartners: deps.cachePartners },
    );
}
