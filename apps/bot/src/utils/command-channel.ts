import { CommandAccessRepository, ServerConfigRepository } from "@database/repositories";

export type CommandChannelVerdict =
    | { ok: true }
    /** The server turned this command off. */
    | { ok: false; reason: "disabled" }
    /** Marked "commands channel only" and used elsewhere: `channelId` is the commands channel. */
    | { ok: false; reason: "commands-channel"; channelId: string }
    /** Limited to some channels and used elsewhere. */
    | { ok: false; reason: "channels"; channelIds: string[] };

/**
 * Where a command may be used, from the server's Command access settings (dashboard):
 *   - limited to some channels → only there;
 *   - marked "commands channel only" → only in the commands channel (when one is set).
 * Nothing set → anywhere. The commands channel itself no longer pulls every command into it: only the commands a
 * server marks. (Plain chat in the commands channel is still deleted by commands-channel-guard.)
 */
export async function checkCommandChannel(guildId: string, commandName: string, channelId: string): Promise<CommandChannelVerdict> {
    const rule = await CommandAccessRepository.getForCommand(guildId, commandName);
    if (!rule) return { ok: true };
    if (rule.disabled) return { ok: false, reason: "disabled" };

    const channels = rule.channelIds ?? [];
    if (channels.length && !channels.includes(channelId)) return { ok: false, reason: "channels", channelIds: channels };

    if (!rule.commandsChannelOnly) return { ok: true };
    const commandsChannelId = await ServerConfigRepository.getCommandsChannel(guildId);
    if (!commandsChannelId || commandsChannelId === channelId) return { ok: true };
    return { ok: false, reason: "commands-channel", channelId: commandsChannelId };
}

export const COMMAND_OFF_MESSAGE = "This command is turned off in this server.";

/** The channel mention(s) to point a member at. */
export function whereToUse(verdict: Exclude<CommandChannelVerdict, { ok: true } | { reason: "disabled" }>): string {
    return verdict.reason === "commands-channel"
        ? `<#${verdict.channelId}>`
        : verdict.channelIds.slice(0, 5).map(id => `<#${id}>`).join(" ");
}
