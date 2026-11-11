import type { Guild } from "discord.js";
import { Logger } from "@logger";
import type { BotClient } from "@core/bot-client";
import { isAllowedGuild } from "./allowed-guilds";
import { sendGuardLog } from "./send-guard-log";
import { isGuildBlocked, onBlockedChange } from "../../../../libs/shared/src/remote-config";

async function leaveIfUnauthorized(client: BotClient, guild: Guild, reason: "left" | "blocked"): Promise<void> {
    // Blocked in the admin console beats the allowlist.
    if (!isGuildBlocked(guild.id) && (await isAllowedGuild(guild.id))) return;

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

    // A server blocked later in the admin console: leave it within a minute.
    onBlockedChange((ids) => {
        for (const id of ids) {
            const guild = client.guilds.cache.get(id);
            if (guild) void leaveIfUnauthorized(client, guild, "blocked");
        }
    });
}
