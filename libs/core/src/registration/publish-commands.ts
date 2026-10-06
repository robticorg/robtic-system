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
 * Production (no COMMAND_GUILD_ID): to **every whitelisted server**, as guild commands — they show
 * up instantly (global ones take up to an hour) and never in a server the bot isn't allowed in.
 * The admin guild (`!admin-guild`) also gets the `scope: "admin"` commands. Old global copies are
 * cleared so they don't show twice. A whitelisted server the bot hasn't joined yet is skipped; it
 * is registered when the bot joins (`publishGuildCommands`), and `!guild <id> add` registers a
 * server right away.
 *
 * Development (COMMAND_GUILD_ID set): everything to that one guild, as before.
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

    if (!commandGuildId) return publishToWhitelist(rest, applicationId, main, admin, adminGuildId, botName);

    let ok = await putCommandRoute(rest, Routes.applicationGuildCommands(applicationId, commandGuildId), main, `guild ${commandGuildId} (instant)`, botName);
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

/** Every whitelisted server (plus the admin guild) gets its commands; global copies are cleared. */
async function publishToWhitelist(
    rest: REST,
    applicationId: string,
    main: object[],
    admin: object[],
    adminGuildId: string | null,
    botName: BotName,
): Promise<boolean> {
    const guildIds = new Set((await AllowedGuildRepository.list()).map(g => g.guildId));
    if (adminGuildId) guildIds.add(adminGuildId);

    let ok = true;
    let published = 0;
    for (const guildId of guildIds) {
        const payload = guildId === adminGuildId ? [...main, ...admin] : main;
        const result = await putGuildCommands(rest, applicationId, guildId, payload, botName);
        if (result === "published") published++;
        if (result === "failed") ok = false;
    }
    Logger.info(`Slash commands published to ${published}/${guildIds.size} whitelisted server(s)`, botName);

    return (await pruneGlobalCommands(rest, applicationId, "whitelist", botName)) && ok;
}

/** Discord's "Missing Access": the bot isn't in that server (yet). Not a failure — it registers on join. */
const MISSING_ACCESS = 50001;

async function putGuildCommands(
    rest: REST,
    applicationId: string,
    guildId: string,
    payload: object[],
    botName: BotName,
): Promise<"published" | "not-joined" | "failed"> {
    try {
        await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: payload });
        Logger.success(`Registered ${payload.length} commands to guild ${guildId}`, botName);
        return "published";
    } catch (error) {
        if ((error as { code?: number }).code === MISSING_ACCESS) {
            Logger.debug(`Not in whitelisted guild ${guildId} yet — its commands register when the bot joins`, botName);
            return "not-joined";
        }
        return (await putCommandRoute(rest, Routes.applicationGuildCommands(applicationId, guildId), payload, `guild ${guildId}`, botName))
            ? "published"
            : "failed";
    }
}

/**
 * Publishes the commands to one whitelisted server — right after `!guild <id> add`, or when the bot
 * joins one. A no-op in development (COMMAND_GUILD_ID), where only that guild has commands.
 */
export async function publishGuildCommands(
    rest: REST,
    applicationId: string,
    commands: Collection<string, CommandConfig>,
    botName: BotName,
    guildId: string,
): Promise<"published" | "not-joined" | "failed" | "dev-mode"> {
    if (process.env.COMMAND_GUILD_ID?.trim()) return "dev-mode";
    const { main, admin } = buildCommandPayload(commands, botName);
    const payload = guildId === (await getAdminGuildId()) ? [...main, ...admin] : main;
    return putGuildCommands(rest, applicationId, guildId, payload, botName);
}

/** Removes every slash command from one server — after `!guild <id> remove`. */
export async function clearGuildCommands(rest: REST, applicationId: string, botName: BotName, guildId: string): Promise<void> {
    if (process.env.COMMAND_GUILD_ID?.trim()) return;
    await putGuildCommands(rest, applicationId, guildId, [], botName);
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
 * Production registers per whitelisted guild too, so the global registry is always emptied.
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
        `Removing ${existing.length} stale global command(s) — commands are registered per guild, so ` +
        "the global copies would only show twice in the picker.",
        botName,
    );

    return putCommandRoute(rest, Routes.applicationCommands(applicationId), [], "global (pruned)", botName);
}
