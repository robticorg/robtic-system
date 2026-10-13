import { Routes, type Collection, type REST } from "discord.js";
import type { CommandConfig } from "@typings/command";
import { AllowedGuildRepository, GlobalConfigRepository } from "@database/repositories";
import { Logger } from "@logger";
import { buildCommandPayload } from "./build-command-payload";
import { putCommandRoute } from "./put-command-route";

/**
 * Publishes the slash commands — every one of them, admin scope included — **on the bot itself**
 * (global commands), so every server the bot is added to already has them. Nothing is registered
 * on a guild. Admin-scope commands are visible everywhere but still run for super users only
 * (see `checkPermissions`).
 *
 * One publish is one request: the bot's global list is replaced, and Discord updates every server
 * from it. It runs once per bot start (and from the deploy workflow on every update).
 *
 * Guild-level copies left on whitelisted servers (from when commands were registered per server,
 * on the admin guild, or on a development guild) are cleared once, the first time this runs:
 * Discord shows guild and global commands side by side, so a stale guild copy would put every
 * command in the picker twice — the old one with its old options. After that no publish touches a
 * guild again.
 *
 * Needs only a REST client and the application id, not a gateway session, so the same code runs
 * at bot startup and from `apps/bot/src/register-commands.ts` in the deploy workflow.
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

    const payload = buildCommandPayload(commands, botName);

    const ok = await putCommandRoute(rest, Routes.applicationCommands(applicationId), payload, "the bot (global)", botName);
    return (await clearGuildCopiesOnce(rest, applicationId, botName)) && ok;
}

/** GlobalConfig key marking that this application's old guild-level commands are gone. */
const guildCopiesClearedKey = (applicationId: string) => `guildCommandCopiesCleared:${applicationId}`;

/** Runs the cleanup until it has fully succeeded once; a failed run is retried on the next publish. */
async function clearGuildCopiesOnce(rest: REST, applicationId: string, botName: BotName): Promise<boolean> {
    const key = guildCopiesClearedKey(applicationId);
    if (await GlobalConfigRepository.get(key)) return true;

    const ok = await clearGuildCopies(rest, applicationId, botName);
    if (ok) await GlobalConfigRepository.set(key, new Date().toISOString());
    return ok;
}

/** Discord's "Missing Access": the bot isn't in that server — so it has no guild commands there either. */
const MISSING_ACCESS = 50001;

/** Empties the guild-level command list of every whitelisted server. Servers the bot isn't in are skipped. */
async function clearGuildCopies(rest: REST, applicationId: string, botName: BotName): Promise<boolean> {
    const guildIds = (await AllowedGuildRepository.list()).map(g => g.guildId);

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
