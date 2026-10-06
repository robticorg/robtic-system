import type { CreateMusicBotInput, CreateMusicBotResult, MusicBotView } from "@core/music";
import { callInternalApi } from "./request";

/** The music app's API (`apps/music`), at `MUSIC_API_URL`. */
export const musicApi = {
    /** Validates the token with Discord and logs the bot in, so it can take a while. */
    create: (input: CreateMusicBotInput, requestId?: string) =>
        callInternalApi<CreateMusicBotResult>("music", "MUSIC_API_URL", "/bots", { method: "POST", body: input, requestId, timeoutMs: 30_000 }),

    list: (guildId: string, requestId?: string) =>
        callInternalApi<MusicBotView[]>("music", "MUSIC_API_URL", `/guilds/${guildId}/bots`, { requestId }),

    remove: (guildId: string, botId: string, requestId?: string) =>
        callInternalApi<{ name: string; voiceChannelId: string } | null>("music", "MUSIC_API_URL", `/guilds/${guildId}/bots/${botId}`, {
            method: "DELETE",
            requestId,
            timeoutMs: 15_000,
        }),
};
