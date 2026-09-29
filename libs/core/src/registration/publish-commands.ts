import { Routes, type Collection, type REST } from "discord.js";
import type { CommandConfig } from "@typings/command";
import { Logger } from "@logger";
import { getAdminGuildId } from "../bot-admin/admin-guild";
import { buildCommandPayload } from "./build-command-payload";
import { putCommandRoute } from "./put-command-route";

/**
 * Publishes commands to up to two routes: the ordinary one, and — for `scope: "admin"` commands
 * — the guild set with `!admin-guild`.
 *
 * Needs only a REST client and the application id, not a gateway session, so the same code runs
 * at bot startup and from `apps/bot/src/register-commands.ts` in the deploy workflow.
 *
 * With no admin guild configured the admin payload is not published anywhere. That is
 * deliberate rather than a fallback to COMMAND_GUILD_ID: admin commands stay fully usable by
 * prefix, because the prefix router resolves against the loaded command collection and never
 * against Discord's registry, so skipping costs nothing and never leaks `/whitelist` into every
 * server the bot joins.
 *
 * Returns false when any route failed to publish.
 */
export async function publishCommands(
    rest: REST,
    applicationId: string,
    commands: Collection<string, CommandConfig>,
    botName: BotName,
): Promise<boolean> {
    if (commands.size === 0) {
        Logger.error("No commands loaded — refusing to publish an empty command list", botName);
        return false;
    }

    const { main, admin } = buildCommandPayload(commands, botName);

    const commandGuildId = process.env.COMMAND_GUILD_ID?.trim() || undefined;
    const adminGuildId = await getAdminGuildId();

    if (adminGuildId && adminGuildId === commandGuildId) {
        const ok = await putCommandRoute(
            rest,
            Routes.applicationGuildCommands(applicationId, adminGuildId),
            [...main, ...admin],
            `guild ${adminGuildId}`,
            botName,
        );
        return (await pruneGlobalCommands(rest, applicationId, commandGuildId, botName)) && ok;
    }

    const mainRoute = commandGuildId
        ? Routes.applicationGuildCommands(applicationId, commandGuildId)
        : Routes.applicationCommands(applicationId);
    const mainLabel = commandGuildId ? `guild ${commandGuildId} (instant)` : "global";

    let ok = await putCommandRoute(rest, mainRoute, main, mainLabel, botName);
    ok = (await pruneGlobalCommands(rest, applicationId, commandGuildId, botName)) && ok;

    if (!admin.length) return ok;

    if (!adminGuildId) {
        Logger.warn(
            `${admin.length} admin-scope command(s) not registered — no admin guild is set. ` +
            `Run \`!admin-guild set <id>\` in the server that should host them. They remain usable by prefix.`,
            botName,
        );
        return ok;
    }

    return (await putCommandRoute(
        rest,
        Routes.applicationGuildCommands(applicationId, adminGuildId),
        admin,
        `admin guild ${adminGuildId}`,
        botName,
    )) && ok;
}

/**
 * Clears globally-registered commands while a command guild is configured.
 *
 * Guild and global commands are separate registries and Discord shows **both** in the picker.
 * A bot that once ran without COMMAND_GUILD_ID leaves its global copies behind forever, so the
 * test server ends up with two identical `/shortcut` entries: one current, one frozen at
 * whatever the options looked like the day it was published. Picking the stale one sends the
 * bot an interaction missing options its handler requires — `Required option "trigger" not
 * found`, from a command that is demonstrably correct in source.
 *
 * Nothing is pruned when no command guild is set: that is the production shape, where the
 * global registry is the real one.
 */
async function pruneGlobalCommands(
    rest: REST,
    applicationId: string,
    commandGuildId: string | undefined,
    botName: BotName,
): Promise<boolean> {
    if (!commandGuildId) return true;

    const existing = await rest
        .get(Routes.applicationCommands(applicationId))
        .catch(() => null) as unknown[] | null;

    if (!existing?.length) return true;

    Logger.warn(
        `Removing ${existing.length} stale global command(s) — COMMAND_GUILD_ID is set, so guild ` +
        "registrations are authoritative and the global copies only shadow them in the picker.",
        botName,
    );

    return putCommandRoute(rest, Routes.applicationCommands(applicationId), [], "global (pruned)", botName);
}
