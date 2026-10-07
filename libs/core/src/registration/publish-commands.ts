import { Routes, type Collection, type REST } from "discord.js";
import type { CommandConfig } from "@typings/command";
import { AllowedGuildRepository } from "@database/repositories";
import { Logger } from "@logger";
import { getAdminGuildId } from "../bot-admin/admin-guild";
import { buildCommandPayload } from "./build-command-payload";
import { putCommandRoute } from "./put-command-route";

/**
 * Publishes the slash commands.
 *
 * Production (no COMMAND_GUILD_ID): **on the bot itself** (global commands), so every server the
 * bot is added to already has them — nothing to register per server. The admin guild
 * (`!admin-guild`) additionally gets the `scope: "admin"` commands as guild commands.
 *
 * Guild-level copies left on whitelisted servers (from when commands were registered per server)
 * are cleared on every publish: Discord shows guild and global commands side by side, so a stale
 * guild copy would put every command in the picker twice — the old one with its old options.
 *
 * Development (COMMAND_GUILD_ID set): everything to that one guild (instant), global cleared.
 *
 * Needs only a REST client and the application id, not a gateway session, so the same code runs
 * at bot startup and from `apps/bot/src/register-commands.ts` in the deploy workflow.
 *
 * With no admin guild configured the admin payload is not published anywhere — admin commands stay
 * usable by prefix, and `/whitelist` never leaks into every server the bot joins.
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

    if (commandGuildId) return publishToDevGuild(rest, applicationId, main, admin, commandGuildId, adminGuildId, botName);

    let ok = await putCommandRoute(rest, Routes.applicationCommands(applicationId), main, "the bot (global)", botName);
    ok = (await clearGuildCopies(rest, applicationId, adminGuildId, botName)) && ok;

    if (!admin.length) return ok;
    if (!adminGuildId) {
        warnNoAdminGuild(admin.length, botName);
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

/** Development: one guild gets everything instantly; the global registry is emptied so nothing shows twice. */
async function publishToDevGuild(
    rest: REST,
    applicationId: string,
    main: object[],
    admin: object[],
    commandGuildId: string,
    adminGuildId: string | null,
    botName: BotName,
): Promise<boolean> {
    const sameGuild = adminGuildId === commandGuildId;
    let ok = await putCommandRoute(
        rest,
        Routes.applicationGuildCommands(applicationId, commandGuildId),
        sameGuild ? [...main, ...admin] : main,
        `guild ${commandGuildId} (instant)`,
        botName,
    );
    ok = (await pruneGlobalCommands(rest, applicationId, botName)) && ok;

    if (sameGuild || !admin.length) return ok;
    if (!adminGuildId) {
        warnNoAdminGuild(admin.length, botName);
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

function warnNoAdminGuild(count: number, botName: BotName): void {
    Logger.warn(
        `${count} admin-scope command(s) not registered — no admin guild is set. ` +
        `Run \`!admin-guild set <id>\` in the server that should host them. They remain usable by prefix.`,
        botName,
    );
}

/** Discord's "Missing Access": the bot isn't in that server — so it has no guild commands there either. */
const MISSING_ACCESS = 50001;

/**
 * Empties the guild-level command list of every whitelisted server except the admin guild (whose
 * guild list holds the admin commands, rewritten right after). Servers the bot isn't in are skipped.
 */
async function clearGuildCopies(rest: REST, applicationId: string, adminGuildId: string | null, botName: BotName): Promise<boolean> {
    const guildIds = (await AllowedGuildRepository.list()).map(g => g.guildId).filter(id => id !== adminGuildId);

    let ok = true;
    for (const guildId of guildIds) {
        try {
            await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: [] });
        } catch (error) {
            if ((error as { code?: number }).code === MISSING_ACCESS) continue;
            Logger.warn(`Could not clear old guild commands in ${guildId}: ${(error as Error).message}`, botName);
            ok = false;
        }
    }
    return ok;
}

/**
 * Clears globally-registered commands while a development command guild is configured.
 *
 * Guild and global commands are separate registries and Discord shows **both** in the picker, so
 * a bot that once ran globally would show every command twice in the test server — one current,
 * one frozen at whatever its options were the day it was published.
 */
async function pruneGlobalCommands(rest: REST, applicationId: string, botName: BotName): Promise<boolean> {
    const existing = await rest
        .get(Routes.applicationCommands(applicationId))
        .catch(() => null) as unknown[] | null;

    if (!existing?.length) return true;

    Logger.warn(
        `Removing ${existing.length} stale global command(s) — COMMAND_GUILD_ID is set, so the dev ` +
        "guild's registrations are authoritative and the global copies would show twice.",
        botName,
    );

    return putCommandRoute(rest, Routes.applicationCommands(applicationId), [], "global (pruned)", botName);
}
