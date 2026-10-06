import { createMusicBot, listMusicBots, removeMusicBot } from "@core/music";
import { musicApi } from "@internal-client";

/**
 * Where music bots run. With `MUSIC_API_URL` they live in the music app (`apps/music`, its own
 * container) and the Gateway only talks to its API — so they keep playing while the Gateway
 * restarts or fails over. Without it (local development) they run in this process, as before.
 *
 * Remote calls throw `InternalApiError` when the music app is down; callers show
 * `unavailableMessage("music")`.
 */
export function musicRunsLocally(): boolean {
    return !process.env.MUSIC_API_URL?.trim();
}

export const musicBackend = {
    create: (input: Parameters<typeof createMusicBot>[0]) => (musicRunsLocally() ? createMusicBot(input) : musicApi.create(input)),
    list: (guildId: string) => (musicRunsLocally() ? listMusicBots(guildId) : musicApi.list(guildId)),
    remove: (guildId: string, botId: string) => (musicRunsLocally() ? removeMusicBot(guildId, botId) : musicApi.remove(guildId, botId)),
};
