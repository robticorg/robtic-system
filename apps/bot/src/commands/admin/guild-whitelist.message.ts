import type { MessageCommandConfig } from "@typings/message-command";
import { SERVER_WHITELIST_MESSAGES, SNOWFLAKE_REGEX, SUPER_ADMIN_ID } from "@constants";
import { AllowedGuildRepository, SuperUserRepository } from "@database/repositories";
import { registerGuildCommands, unregisterGuildCommands } from "@bot/guards/register-guild-commands";

/**
 * `<prefix>guild <server id> add` / `<prefix>guild <server id> remove` — the server whitelist the
 * guild guard enforces (the bot leaves any server not on it). Prefix-only, with the server's own
 * prefix, and only for the bot owner and super users; for anyone else the command doesn't exist —
 * no reply, nothing that reveals it.
 *
 * `add` before inviting the bot, or the guard makes it leave straight away. Also accepted in the
 * other order (`guild add <id>`).
 */

type Action = "add" | "remove";

/** Parses `<id> add|remove` (either order). `null` = not understood → show usage. */
export function parseGuildWhitelistArgs(argString: string): { guildId: string; action: Action } | null {
    const words = argString.trim().split(/\s+/).filter(Boolean).map(w => w.toLowerCase());
    if (words.length !== 2) return null;
    const action = words.find((w): w is Action => w === "add" || w === "remove");
    const guildId = words.find(w => w !== action);
    if (!action || !guildId) return null;
    return { guildId, action };
}

async function isSuperUser(userId: string): Promise<boolean> {
    return userId === SUPER_ADMIN_ID || (await SuperUserRepository.isWhitelisted(userId));
}

export default {
    name: "guild",
    async run({ message, client, prefix, argString }) {
        if (!(await isSuperUser(message.author.id))) return false; // not handled → nothing happens

        const parsed = parseGuildWhitelistArgs(argString);
        if (!parsed) {
            await message.reply({ content: SERVER_WHITELIST_MESSAGES.usage(prefix), allowedMentions: { repliedUser: false } });
            return true;
        }

        const { guildId, action } = parsed;
        if (!SNOWFLAKE_REGEX.test(guildId)) {
            await message.reply({ content: SERVER_WHITELIST_MESSAGES.invalidId(guildId), allowedMentions: { repliedUser: false } });
            return true;
        }

        let reply: string;
        if (action === "add") {
            const name = client.guilds.cache.get(guildId)?.name;
            reply = (await AllowedGuildRepository.add(guildId, message.author.id, name))
                ? SERVER_WHITELIST_MESSAGES.added(guildId, name)
                : SERVER_WHITELIST_MESSAGES.alreadyAdded(guildId);
            // Already in the server (or re-adding one): its slash commands now. Not in it yet: on join.
            const registered = await registerGuildCommands(client, guildId).catch(() => "failed" as const);
            reply += `\n${SERVER_WHITELIST_MESSAGES.commands[registered]}`;
        } else if (guildId === message.guildId) {
            reply = SERVER_WHITELIST_MESSAGES.cannotRemoveCurrent;
        } else {
            const removed = await AllowedGuildRepository.remove(guildId);
            if (removed) await unregisterGuildCommands(client, guildId).catch(() => null);
            reply = removed ? SERVER_WHITELIST_MESSAGES.removed(guildId) : SERVER_WHITELIST_MESSAGES.notListed(guildId);
        }

        await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
        return true;
    },
} satisfies MessageCommandConfig;
