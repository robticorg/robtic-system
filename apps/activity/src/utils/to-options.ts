import type { GuildChannelInfo, GuildRoleInfo } from "../types/admin";

export interface EntityOption {
    id: string;
    name: string;
}

/** Text-capable channels (text, announcement, forum) as pickable options — categories are dropped. */
const TEXT_CHANNEL_TYPES = new Set([0, 5, 15]);

export function channelOptions(channels: GuildChannelInfo[]): EntityOption[] {
    return channels
        .filter((channel) => TEXT_CHANNEL_TYPES.has(channel.type))
        .map((channel) => ({ id: channel.id, name: `# ${channel.name}` }));
}

export function roleOptions(roles: GuildRoleInfo[]): EntityOption[] {
    return roles
        .filter((role) => !role.managed)
        .map((role) => ({ id: role.id, name: role.name }));
}
