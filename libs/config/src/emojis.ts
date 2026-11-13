import { getEmojiOverride } from "../../shared/src/remote-config";
import { currentGuildId } from "../../utils/src/lang-context";

/**
 * The bot's emojis. Each key is a slot the admin console can fill (admin.robtic.org → Discord → Emojis); an empty slot
 * uses the default here. The slot list in robtic-discord (libs/shared/src/emojis.ts) must name the same keys.
 */
const DEFAULT_EMOJIS = {
    top_rank: "#️⃣",
    top_text: "💬",
    top_voice: "🎙️",
    top_board: "🏆",
    top_prev: "",
    top_next: "",
    roles_search: "🔍",
    roles_filter: "⚙️",
    lock: "<:security:1480429199427899412>",
    info: "<:info:1480426659747463242>",
    dots: "<:minidot:1482015855305949375>",
    share: "<:share:1480429249616678922>",
    youtube: "<:youtube:1482084777770352681>",
    leftArrow: "<:forward:1480426683570983014>",
    user: "<:user:1480429275508117587>",
    manager: "",
    suggestion: "",
    gear: "<:setting:1480429221280092310>",
    "robtic-reading": "<:2reading:1479437373854187642>",
    scan: "<:qrcode:1481624212119621632>",
    status: "<:status:1487417362754961459>",
    trophy: "<:trophy:1487417837952696370>",
    computer: "<:webdevelopment:1482103003468136518>",
    note: "<:note:1487418535256002710>",
    eyes: "<:eyes:1482105548655558706>",
    down: "<:down:1480426699878567998>",
    add: "<:add:1480426720967266334>",
} as const;

export type EmojiKey = keyof typeof DEFAULT_EMOJIS;

/** How a server's own emojis are found (set by the server cache in @core/style/accent, which loads them). */
let guildLookup: ((guildId: string, key: string) => string | undefined) | null = null;
export const setGuildEmojiLookup = (fn: typeof guildLookup): void => { guildLookup = fn; };

/** The emoji for a slot: the current server's own (dashboard), else the admin console's, else the default. */
export function emoji(key: EmojiKey): string {
    const guildId = currentGuildId();
    return (guildId ? guildLookup?.(guildId, key) : undefined) ?? getEmojiOverride(key) ?? DEFAULT_EMOJIS[key];
}

/**
 * The same emojis under the old name. Every read goes through `emoji()`, so existing code picks up the admin console's
 * choices without changing.
 */
export const BRANCH_EMOJIS: Readonly<Record<EmojiKey, string>> = new Proxy(DEFAULT_EMOJIS, {
    get: (target, key) => (typeof key === "string" && key in target ? emoji(key as EmojiKey) : Reflect.get(target, key)),
});

/** A button can only take a custom emoji as an id: `<:name:id>` → { id, name, animated }; a plain emoji passes as is. */
export function buttonEmoji(value: string): { id?: string; name?: string; animated?: boolean } | undefined {
    if (!value) return undefined;
    const m = /^<(a?):(\w{2,32}):(\d{15,22})>$/.exec(value);
    return m ? { id: m[3], name: m[2], animated: m[1] === "a" } : { name: value };
}
