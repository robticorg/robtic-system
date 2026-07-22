import type { Guild } from "discord.js";
import { Logger } from "@logger";
import type { BotClient } from "@core/bot-client";
import { isAllowedGuild } from "./allowed-guilds";
import { sendGuardLog } from "./send-guard-log";

export function setupGuildGuard(client: BotClient): void {
    client.guilds.cache.forEach((guild) => {
        if (!isAllowedGuild(guild.id)) {
            guild.leave().then(() => {
                Logger.warn(`Left unauthorized guild: ${guild.name} (${guild.id})`, client.botName);
                sendGuardLog(client, guild, "left");
            }).catch((err) => {
                Logger.error(`Failed to leave guild ${guild.name} (${guild.id}): ${err}`, client.botName);
            });
        }
    });

    client.on("guildCreate", (guild: Guild) => {
        if (!isAllowedGuild(guild.id)) {
            Logger.warn(`Joined unauthorized guild: ${guild.name} (${guild.id}), leaving...`, client.botName);
            sendGuardLog(client, guild, "blocked");
            guild.leave().catch((err) => {
                Logger.error(`Failed to leave guild ${guild.name} (${guild.id}): ${err}`, client.botName);
            });
        }
    });
}
