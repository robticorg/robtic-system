import { AsyncLocalStorage } from "node:async_hooks";
import type { Lang } from "@typings/lang";

/**
 * The language of whatever the bot is handling right now: the language of the server the event, command or button
 * came from (dashboard → General → Language). It is set once where events enter the bot (the event loader) and
 * follows every await from there, so text anywhere below can pick the right language without being handed it.
 *
 * Outside any server (a DM, a timer that isn't tied to one) it is the default.
 */

/** What a server that never picked a language gets: the bot was Arabic-only before the choice existed. */
export const DEFAULT_LANG: Lang = "ar";

const store = new AsyncLocalStorage<Lang>();

/** The language outside any server: the default, unless a script changed it (enterLang). */
let fallback: Lang = DEFAULT_LANG;

export const currentLang = (): Lang => store.getStore() ?? fallback;

/** Runs `fn` with `lang` as the current language. */
export const runWithLang = <T>(lang: Lang, fn: () => T): T => store.run(lang, fn);

/** Sets the language outside any server for the rest of the run (scripts and tests). Never used by the bot. */
export const enterLang = (lang: Lang): void => { fallback = lang; };

/** One piece of text in both languages: the current one is returned. */
export const L = (en: string, ar: string): string => (currentLang() === "ar" ? ar : en);

/**
 * A message list in both languages, used exactly like the plain object it replaces (`MSG.guildOnly`,
 * `MSG.banned(user)`): every read returns the current language's entry. Both sides must have the same keys, which
 * the type enforces.
 */
export function bilingual<T extends object>(en: T, ar: NoInfer<T>): T {
    return new Proxy(en, {
        get: (_target, key) => Reflect.get(currentLang() === "ar" ? ar : en, key),
        has: (_target, key) => key in en,
        ownKeys: () => Reflect.ownKeys(en),
        getOwnPropertyDescriptor: (_target, key) => {
            const d = Reflect.getOwnPropertyDescriptor(currentLang() === "ar" ? ar : en, key);
            return d ? { ...d, configurable: true } : undefined;
        },
    });
}

/** The server an event is about, from its arguments: an interaction, message, member, channel, role, guild… */
export function guildIdOf(args: readonly unknown[]): string | null {
    for (const arg of args) {
        if (!arg || typeof arg !== "object") continue;
        const a = arg as { guildId?: unknown; guild?: { id?: unknown }; id?: unknown; members?: unknown; channels?: unknown };
        if (typeof a.guildId === "string") return a.guildId;
        if (a.guild && typeof a.guild.id === "string") return a.guild.id;
        // A Guild itself (guildCreate, guildUpdate): it has members and channels managers.
        if (a.members && a.channels && typeof a.id === "string") return a.id;
    }
    return null;
}
