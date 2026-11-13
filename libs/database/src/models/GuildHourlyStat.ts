import { Schema, model, type Document } from "mongoose";

/**
 * A server's messages per hour, one row per UTC day: `hours[0]` is 00:00–00:59 UTC. Server totals only (no members),
 * for the activity chart under `/top`. Rows past their use are dropped by the TTL index.
 */
export interface IGuildHourlyStat extends Document {
    guildId: string;
    /** UTC day, `YYYY-MM-DD`. */
    day: string;
    hours: number[];
    expiresAt: Date;
}

const guildHourlyStatSchema = new Schema<IGuildHourlyStat>({
    guildId: { type: String, required: true },
    day: { type: String, required: true },
    hours: { type: [Number], default: () => Array(24).fill(0) },
    expiresAt: { type: Date, required: true },
});

guildHourlyStatSchema.index({ guildId: 1, day: 1 }, { unique: true });
guildHourlyStatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GuildHourlyStat = model<IGuildHourlyStat>("GuildHourlyStat", guildHourlyStatSchema);
