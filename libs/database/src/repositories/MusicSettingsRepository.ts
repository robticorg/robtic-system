import { MUSIC_WORD_KEYS, MusicSettings, type MusicWords } from "@database/models/MusicSettings";

/** A server's music settings with every default filled in. */
export interface ResolvedMusicSettings {
    commands: boolean;
    panel: boolean;
    stay: boolean;
    words: MusicWords;
}

/** The words each command answers to when a server hasn't set its own (the same words as before). */
export const DEFAULT_MUSIC_WORDS: MusicWords = {
    play: ["ش", "شغل", "play", "p"],
    stop: ["وقف", "stop"],
    skip: ["تخطي", "skip"],
    pause: ["ايقاف", "pause"],
    resume: ["كمل", "resume"],
    volume: ["صوت", "volume", "vol"],
};

export const DEFAULT_MUSIC_SETTINGS: ResolvedMusicSettings = { commands: true, panel: true, stay: true, words: DEFAULT_MUSIC_WORDS };

/** The dashboard writes these; the bot reads them often (every message in a voice chat), so they're cached briefly. */
const CACHE_MS = 30_000;
const cache = new Map<string, { value: ResolvedMusicSettings; until: number }>();

const cleanWords = (list: unknown): string[] =>
    Array.isArray(list) ? [...new Set(list.map(w => String(w).trim().toLowerCase()).filter(w => w && w.length <= 20 && !/\s/.test(w)))].slice(0, 10) : [];

export function resolveMusicSettings(doc: { commands?: boolean; panel?: boolean; stay?: boolean; words?: Partial<MusicWords> } | null): ResolvedMusicSettings {
    const d = DEFAULT_MUSIC_SETTINGS;
    const words = Object.fromEntries(MUSIC_WORD_KEYS.map(k => {
        const own = cleanWords(doc?.words?.[k]);
        // An empty list keeps the defaults: a command can't end up with no word at all.
        return [k, own.length ? own : d.words[k]];
    })) as MusicWords;
    return {
        commands: typeof doc?.commands === "boolean" ? doc.commands : d.commands,
        panel: typeof doc?.panel === "boolean" ? doc.panel : d.panel,
        stay: typeof doc?.stay === "boolean" ? doc.stay : d.stay,
        words,
    };
}

export class MusicSettingsRepository {
    static async get(guildId: string): Promise<ResolvedMusicSettings> {
        const hit = cache.get(guildId);
        if (hit && hit.until > Date.now()) return hit.value;
        const doc = await MusicSettings.findOne({ guildId }).lean().catch(() => null);
        const value = resolveMusicSettings(doc);
        cache.set(guildId, { value, until: Date.now() + CACHE_MS });
        return value;
    }

    /** Drops the cache, so the next read sees the dashboard's latest save. */
    static forget(guildId?: string): void {
        if (guildId) cache.delete(guildId);
        else cache.clear();
    }
}
