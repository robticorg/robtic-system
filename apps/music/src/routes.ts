import { ApiError } from "@sdk";
import { requireSnowflake, type InternalRoute } from "@internal-api";
import {
    createMusicBot,
    ensureAllMusicBots,
    listMusicBots,
    removeMusicBot,
    type CreateMusicBotInput,
    type CreateMusicBotResult,
    type MusicBotView,
} from "@core/music";

/**
 * The music app's API — how the Gateway creates, lists and removes music bots. Internal only
 * (private network + `x-internal-token`). The token in `POST /bots` is encrypted before it is
 * stored and never returned.
 *
 * The service is injectable so the routes can be tested without Discord or a database.
 */
export interface MusicService {
    create(input: CreateMusicBotInput): Promise<CreateMusicBotResult>;
    list(guildId: string): Promise<MusicBotView[]>;
    remove(guildId: string, botId: string): Promise<{ name: string; voiceChannelId: string } | null>;
    /** Restarts every bot that is offline; online ones are left playing. */
    ensureAll(): Promise<{ restarted: number; alreadyOnline: number; failed: number }>;
}

export const musicService: MusicService = { create: createMusicBot, list: listMusicBots, remove: removeMusicBot, ensureAll: ensureAllMusicBots };

function requireText(value: unknown, field: string, max: number): string {
    if (typeof value !== "string" || !value.trim() || value.length > max) throw ApiError.validation({ [field]: `must be text up to ${max} characters` });
    return value;
}

function parseCreate(body: unknown): CreateMusicBotInput {
    const b = (body ?? {}) as Record<string, unknown>;
    return {
        guildId: requireSnowflake(b.guildId as string, "guildId"),
        voiceChannelId: requireSnowflake(b.voiceChannelId as string, "voiceChannelId"),
        createdBy: requireSnowflake(b.createdBy as string, "createdBy"),
        mainBotId: requireSnowflake(b.mainBotId as string, "mainBotId"),
        token: requireText(b.token, "token", 200),
        name: requireText(b.name, "name", 32),
    };
}

export function musicRoutes(service: MusicService = musicService): InternalRoute[] {
    return [
        {
            method: "POST",
            path: /^\/bots$/,
            handler: async ({ body }) => service.create(parseCreate(body)),
        },
        {
            method: "POST",
            path: /^\/bots\/ensure$/,
            handler: async () => service.ensureAll(),
        },
        {
            method: "GET",
            path: /^\/guilds\/([^/]+)\/bots$/,
            handler: async ({ params }) => service.list(requireSnowflake(params[0], "guildId")),
        },
        {
            method: "DELETE",
            path: /^\/guilds\/([^/]+)\/bots\/([^/]+)$/,
            handler: async ({ params }) => service.remove(requireSnowflake(params[0], "guildId"), requireSnowflake(params[1], "botId")),
        },
    ];
}
