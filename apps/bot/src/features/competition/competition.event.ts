import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { handleError, BotError } from "@core/handlers";
import { ensureAllCompetitionBots } from "./lib/runtime";
import { setMainClient } from "./lib/stats";

export default [
    /** TEMP — every saved competition bot comes back online with the main bot. */
    {
        name: Events.ClientReady,
        once: true,
        execute: client => {
            setMainClient(client);
            void ensureAllCompetitionBots()
                .catch(err => handleError(new BotError(`Failed to start competition bots: ${err}`, "EVENT"), "main/competition"));
        },
    } satisfies EventConfig<Events.ClientReady>,
];
