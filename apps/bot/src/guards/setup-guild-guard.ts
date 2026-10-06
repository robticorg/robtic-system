import type { Guild } from "discord.js";
import { Logger } from "@logger";
import type { BotClient } from "@core/bot-client";
import { isAllowedGuild } from "./allowed-guilds";
import { sendGuardLog } from "./send-guard-log";
import { registerGuildCommands } from "./register-guild-commands";

async function leaveIfUnauthorized(client: BotClient, guild: Guild, reason: "left" | "blocked"): Promise<void> {
    if (await isAllowedGuild(guild.id)) {
        // Just invited to a whitelisted server: its slash commands, now rather than at the next deploy.
        if (reason === "blocked") await registerGuildCommands(client, guild.id).catch(() => null);
        return;
    }

    Logger.warn(
        reason === "blocked"
            ? `Joined unauthorized guild: ${guild.name} (${guild.id}), leaving...`
            : `Left unauthorized guild: ${guild.name} (${guild.id})`,
        client.botName,
    );

    await sendGuardLog(client, guild, reason);

    await guild.leave().catch((err) => {
        Logger.error(`Failed to leave guild ${guild.name} (${guild.id}): ${err}`, client.botName);
    });
}

export async function setupGuildGuard(client: BotClient): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
        await leaveIfUnauthorized(client, guild, "left");
    }

    client.on("guildCreate", (guild: Guild) => {
        void leaveIfUnauthorized(client, guild, "blocked");
    });
}
