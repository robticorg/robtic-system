import type { Client } from "discord.js";
import { Logger } from "@logger";
import { pruneStaleChannelBuffers } from "../conversation-detector";
import { processGuildCombos } from "./process-guild-combos";

import { inGuildLang } from "@bot/utils/lang";
const CTX = "main:combo-scheduler";

export async function runComboCycle(client: Client): Promise<void> {
    for (const [, guild] of client.guilds.cache) {
        await inGuildLang(guild.id, () => processGuildCombos(guild)).catch(err =>
            Logger.error(`Combo cycle failed for guild ${guild.id}: ${err}`, CTX)
        );
    }
    pruneStaleChannelBuffers();
}
