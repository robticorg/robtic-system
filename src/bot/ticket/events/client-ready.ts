import { Events } from "discord.js";
import type { BotClient } from "@core/BotClient.ts";
import { Logger } from "@core/libs";
import { setPresence, setupGuildGuard } from "@shared/index";
import { BRANCH_CONFIG } from "@core/config";

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: BotClient) {
        Logger.success(`Logged in as ${client.user?.tag}`, client.botName);
        Logger.debug(`Bot ID: ${client.user?.id}`, client.botName);
        Logger.debug(`Serving ${client.guilds.cache.size} guild(s)`, client.botName);

        setPresence(client, "dnd", "Playing", [...BRANCH_CONFIG.presence.ticket])
        setupGuildGuard(client);
    },
};
