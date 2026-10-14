import type { Client } from "discord.js";
import { Logger } from "@logger";

/**
 * TEMP — the competition's emojis live in another server, where the competition bot isn't, so it
 * can't use them as they are. On start it copies each one into its **own application emojis**
 * (Developer Portal → Emojis), which a bot can use in every server. Already copied ones are reused.
 */

export type EmojiName = "minidot" | "info" | "add";

/** The original emojis — copied from the CDN by id. */
const SOURCE: Record<EmojiName, string> = {
    minidot: "1482015855305949375",
    info: "1480426659747463242",
    add: "1480426720967266334",
};

/** `<:name:id>` for each emoji — the originals until the bot's own copies are ready. */
export type CompetitionEmojis = Record<EmojiName, string>;

export const SOURCE_EMOJIS: CompetitionEmojis = {
    minidot: `<:minidot:${SOURCE.minidot}>`,
    info: `<:info:${SOURCE.info}>`,
    add: `<:add:${SOURCE.add}>`,
};

/** `{ id, name }` for a button, from `<:name:id>` / `<a:name:id>`. */
export function buttonEmoji(emoji: string): { id: string; name: string; animated?: boolean } {
    const [, a, name = "", id = ""] = /^<(a?):(\w+):(\d+)>$/.exec(emoji) ?? [];
    return { id, name, ...(a ? { animated: true } : {}) };
}

async function download(id: string): Promise<{ data: Buffer; animated: boolean } | null> {
    for (const [ext, animated] of [["gif", true], ["png", false]] as const) {
        const res = await fetch(`https://cdn.discordapp.com/emojis/${id}.${ext}`).catch(() => null);
        if (res?.ok) return { data: Buffer.from(await res.arrayBuffer()), animated };
    }
    return null;
}

/** The bot's own copy of each emoji, uploading the missing ones. Any that fails keeps the original. */
export async function ensureApplicationEmojis(client: Client<true>, ctx: string): Promise<CompetitionEmojis> {
    const result: CompetitionEmojis = { ...SOURCE_EMOJIS };
    const existing = await client.application.emojis.fetch().catch(() => null);

    for (const name of Object.keys(SOURCE) as EmojiName[]) {
        try {
            let emoji = existing?.find(e => e.name === name);
            if (!emoji) {
                const file = await download(SOURCE[name]);
                if (!file) throw new Error("couldn't download it from Discord's CDN");
                emoji = await client.application.emojis.create({ attachment: file.data, name });
                Logger.info(`Uploaded the ${name} emoji to the bot's application emojis`, ctx);
            }
            result[name] = emoji.toString();
        } catch (err) {
            Logger.warn(`Emoji ${name}: ${err instanceof Error ? err.message : err} — using the original`, ctx);
        }
    }
    return result;
}
