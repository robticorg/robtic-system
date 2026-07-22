import { discordBotGet } from "./discord-api";

export interface GuildChannelInfo {
    id: string;
    name: string;
    type: number;
    parentId: string | null;
    position: number;
}

export interface GuildRoleInfo {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

interface RawChannel { id: string; name: string; type: number; parent_id: string | null; position: number }
interface RawRole { id: string; name: string; color: number; position: number; managed: boolean }

/** Text-capable channel types the config pickers offer: text, announcement, forum, and categories (for grouping). */
const SELECTABLE_CHANNEL_TYPES = new Set([0, 4, 5, 15]);

/** Channels and roles for the panel's dropdowns. Empty arrays when the bot token is absent — the UI still renders, just without pickers. */
export async function fetchGuildMetadata(guildId: string): Promise<{ channels: GuildChannelInfo[]; roles: GuildRoleInfo[] }> {
    const [rawChannels, rawRoles] = await Promise.all([
        discordBotGet<RawChannel[]>(`/guilds/${guildId}/channels`),
        discordBotGet<RawRole[]>(`/guilds/${guildId}/roles`),
    ]);

    const channels = (rawChannels ?? [])
        .filter(channel => SELECTABLE_CHANNEL_TYPES.has(channel.type))
        .map(channel => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parentId: channel.parent_id,
            position: channel.position,
        }))
        .sort((a, b) => a.position - b.position);

    const roles = (rawRoles ?? [])
        .filter(role => role.id !== guildId)
        .map(role => ({
            id: role.id,
            name: role.name,
            color: role.color,
            position: role.position,
            managed: role.managed,
        }))
        .sort((a, b) => b.position - a.position);

    return { channels, roles };
}
