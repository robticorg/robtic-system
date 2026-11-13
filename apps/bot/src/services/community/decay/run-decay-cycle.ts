import type { Client } from "discord.js";
import { processGuildDecay } from "./process-guild-decay";

import { inGuildLang } from "@bot/utils/lang";
export async function runDecayCycle(client: Client): Promise<void> {
    for (const [, guild] of client.guilds.cache) {
        await inGuildLang(guild.id, () => processGuildDecay(client, guild));
    }
}
