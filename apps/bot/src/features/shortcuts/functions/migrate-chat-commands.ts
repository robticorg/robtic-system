import { CommandAccess, Shortcut } from "@database/models";
import { CommandAccessRepository, ShortcutRepository } from "@database/repositories";
import { Logger } from "@logger";

const CTX = "shortcuts";

/** The commands /chat's subcommands became (2026-11), `show` now being `unhide`. */
const TOOLS = ["lock", "unlock", "hide", "unhide", "slowmode", "clear"] as const;
const RENAMED: Record<string, string> = { show: "unhide" };

/**
 * /chat lock|unlock|hide|show|slowmode|clear became /lock … /clear. Moves what servers set up for the old command:
 *   - shortcuts that ran `chat <tool>` or the old `show` utility now run the new command;
 *   - a /chat access entry (roles, tiers, channels, off) is copied to each new command that has none yet, then removed.
 * Runs on every start; once nothing is left to move it costs two queries.
 */
export async function migrateChatCommands(): Promise<void> {
    const guilds = new Set<string>();
    let shortcuts = 0;
    let grants = 0;

    const old = await Shortcut.find({ command: { $in: ["show", /^chat( |$)/] } }).catch(() => []);
    for (const s of old) {
        const rest = s.command.startsWith("chat") ? s.command.slice(4).trim() : s.command;
        const name = RENAMED[rest] ?? rest;
        if (!(TOOLS as readonly string[]).includes(name)) continue; // a bare `chat` with no tool: left for the orphan report
        await Shortcut.updateOne({ _id: s._id }, { $set: { command: name } }).catch(err => Logger.warn(`Shortcut ${s.trigger}: ${err}`, CTX));
        guilds.add(s.guildId);
        shortcuts++;
    }

    const access = await CommandAccess.find({ commandName: "chat" }).catch(() => []);
    for (const a of access) {
        for (const name of TOOLS) {
            const exists = await CommandAccess.exists({ guildId: a.guildId, commandName: name });
            if (exists) continue;
            await CommandAccess.create({
                guildId: a.guildId, commandName: name, allowedRoleIds: a.allowedRoleIds, allowedCategoryKeys: a.allowedCategoryKeys,
                channelIds: a.channelIds, commandsChannelOnly: a.commandsChannelOnly, disabled: a.disabled,
            }).catch(err => Logger.warn(`Access for /${name} in ${a.guildId}: ${err}`, CTX));
        }
        await CommandAccess.deleteOne({ _id: a._id });
        guilds.add(a.guildId);
        grants++;
    }

    for (const g of guilds) {
        ShortcutRepository.invalidate(g);
        CommandAccessRepository.invalidate(g);
    }
    if (shortcuts || grants) Logger.info(`/chat split: ${shortcuts} shortcut(s) and ${grants} access setting(s) moved to /lock … /clear`, CTX);
}
