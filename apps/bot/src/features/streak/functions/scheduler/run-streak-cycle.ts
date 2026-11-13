import type { Client } from "discord.js";
import { isFeatureEnabled } from "@core/features";
import { processGuildStreaks } from "./process-guild-streaks";

import { inGuildLang } from "@bot/utils/lang";
/**
 * The activation check is per guild and inside the loop, not once at startup: a guild can enable or
 * disable streaks at any time, and the scheduler outlives that decision.
 */
export async function runStreakCycle(client: Client): Promise<void> {
    for (const [, guild] of client.guilds.cache) {
        if (!(await isFeatureEnabled(guild.id, "streak"))) continue;
        await inGuildLang(guild.id, () => processGuildStreaks(client, guild));
    }
}
