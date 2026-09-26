import { Events } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { Logger } from "@logger";
import { BRANCH_CONFIG } from "@config";
import { setPresence } from "../utils/set-presence";
import { setupGuildGuard } from "../guards/setup-guild-guard";
import { publishFeatureCatalog } from "../guards/publish-feature-catalog";
import { startMinecraftScheduler } from "../services/minecraft";
import { startDecayScheduler } from "../services/community/decay";
import { startSessionCleanupScheduler } from "../services/community/support";
import { startActivityFlush } from "../services/activity-flush";

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: BotClient) {
        Logger.success(`Logged in as ${client.user?.tag}`, client.botName);
        Logger.debug(`Bot ID: ${client.user?.id}`, client.botName);
        Logger.debug(`Serving ${client.guilds.cache.size} guild(s)`, client.botName);

        setPresence(client, "dnd", "Playing", [...BRANCH_CONFIG.presence]);
        await setupGuildGuard(client);
        await publishFeatureCatalog();

        startMinecraftScheduler(client);
        startDecayScheduler(client);
        startSessionCleanupScheduler();
        startActivityFlush();
    },
};
