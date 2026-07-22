import { Events } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { Logger } from "@logger";
import { BRANCH_CONFIG } from "@config";
import { setPresence, setupGuildGuard } from "@shared/index";
import { startDecayScheduler } from "../services/decay";
import { startSessionCleanupScheduler } from "../services/support";

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: BotClient) {
        Logger.success(`Logged in as ${client.user?.tag}`, client.botName);
        Logger.debug(`Bot ID: ${client.user?.id}`, client.botName);
        Logger.debug(`Serving ${client.guilds.cache.size} guild(s)`, client.botName);

        setPresence(client, "online", "Streaming", [...BRANCH_CONFIG.presence.community]);
        setupGuildGuard(client);
        startDecayScheduler(client);
        startSessionCleanupScheduler();
    },
};
