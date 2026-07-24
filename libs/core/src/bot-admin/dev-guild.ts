import { GlobalConfigRepository } from "@database/repositories";

/** GlobalConfig key holding the dev server's guild id (gates the Activity's Projects area). */
const DEV_GUILD_KEY = "devGuildId";

export async function getDevGuildId(): Promise<string | null> {
    return GlobalConfigRepository.get(DEV_GUILD_KEY);
}

/** Sets (or clears, with null/empty) the dev server id. Caller must already be authorized. */
export async function setDevGuildId(guildId: string | null): Promise<void> {
    if (!guildId) {
        await GlobalConfigRepository.delete(DEV_GUILD_KEY);
        return;
    }
    await GlobalConfigRepository.set(DEV_GUILD_KEY, guildId);
}
