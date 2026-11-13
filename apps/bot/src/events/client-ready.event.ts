import { Events } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { Logger } from "@logger";
import { BRANCH_CONFIG } from "@config";
import { setPresence } from "../utils/set-presence";
import { setupGuildGuard } from "../guards/setup-guild-guard";
import { publishFeatureCatalog } from "../guards/publish-feature-catalog";
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

        // Slash commands are published on every start, so a new or changed command (an option, a description) is live
        // as soon as the bot restarts, without running register:commands by hand. One request: Discord replaces the
        // bot's whole list. Not awaited, so a slow or failed publish never holds up the bot; a failure is logged.
        void client.registerSlashCommands()
            .then(ok => ok
                ? Logger.success(`Slash commands published (${client.commands.size})`, client.botName)
                : Logger.warn("Slash commands were not fully published; they update on the next start", client.botName))
            .catch(err => Logger.error(`Publishing slash commands failed: ${err}`, client.botName));

        startDecayScheduler(client);
        startSessionCleanupScheduler();
        startActivityFlush();
    },
};
