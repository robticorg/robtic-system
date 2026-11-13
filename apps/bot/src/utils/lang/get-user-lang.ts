import type { GuildMember } from "discord.js";
import type { Lang } from "@typings/lang";
import { ServerConfigRepository } from "@database/repositories";
import { DEFAULT_LANG, runWithLang } from "@utils";

export { DEFAULT_LANG };

/** The language a server picked on the dashboard (General → Language). */
export async function getGuildLang(guildId: string | null | undefined): Promise<Lang> {
    if (!guildId) return DEFAULT_LANG;
    return (await ServerConfigRepository.getLanguage(guildId).catch(() => null)) ?? DEFAULT_LANG;
}

/**
 * The language to answer a member in: their server's. Still takes a member (not a guild id) so the
 * existing call sites stay as they are.
 */
export async function getUserLang(member: GuildMember | null | undefined): Promise<Lang> {
    return getGuildLang(member?.guild?.id);
}

/** Runs `fn` in a server's language: for work that doesn't come from an event (schedulers, queued jobs). */
export async function inGuildLang<T>(guildId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
    return runWithLang(await getGuildLang(guildId), fn);
}
