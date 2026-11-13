import type { Guild } from "discord.js";
import { MUSIC_CONFIG } from "@constants";
import type { IMusicBot } from "@database/models";

import { L } from "@utils";
/**
 * Gives a music bot what it needs on its own voice channel — and nothing anywhere else, since it
 * is invited with no permissions. Done by the main bot (which needs Manage Roles there), and only
 * once the music bot is a member: Discord can't add a member overwrite for someone not in the
 * server. Returns a problem to show staff, or `null` when it worked.
 */
export async function grantVoicePermissions(guild: Guild, record: Pick<IMusicBot, "botId" | "voiceChannelId">): Promise<string | null> {
    const channel = guild.channels.cache.get(record.voiceChannelId) ?? await guild.channels.fetch(record.voiceChannelId).catch(() => null);
    if (!channel?.isVoiceBased()) return L("its voice channel no longer exists", "رومه الصوتي ما عاد موجود");
    if (!guild.members.cache.has(record.botId) && !(await guild.members.fetch(record.botId).catch(() => null))) return L("it isn't in the server yet", "مو موجود في السيرفر لين الحين");

    const allow = Object.fromEntries(MUSIC_CONFIG.channelPermissions.map(name => [name, true]));
    try {
        await channel.permissionOverwrites.edit(record.botId, allow, { reason: "Music bot: its assigned voice channel" });
        return null;
    } catch {
        return L(`I couldn't set its permissions on <#${channel.id}>: I need **Manage Roles** (Manage Permissions) there`, `ما قدرت أضبط صلاحياته في <#${channel.id}>: أحتاج **Manage Roles** هناك`);
    }
}
