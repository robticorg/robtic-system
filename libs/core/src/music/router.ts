import type { MusicBotInstance } from "./engine/music-bot-instance";
import { L } from "@utils";

/**
 * Which music bot answers someone in a voice channel. The rules, in order:
 *
 *   1. the channel has a **fixed** bot → that bot, and only that bot (a roaming bot never joins a channel that has one);
 *   2. a bot is already in the channel (a roaming bot playing there) → that bot;
 *   3. otherwise, when starting music, a **roaming** bot that isn't busy joins (the same one every time: lowest id);
 *   4. otherwise nobody: the person is told which channels have music.
 *
 * Used by the text commands (every music bot sees the message; one answers) and by the control panel.
 */

export type Pick =
    | { ok: true; bot: MusicBotInstance }
    | { ok: false; reason: "no-voice" | "busy" | "none" | "nothing-here" };

export function pickBot(bots: readonly MusicBotInstance[], voiceChannelId: string | null, opts: { starting: boolean }): Pick {
    if (!voiceChannelId) return { ok: false, reason: "no-voice" };
    const ready = bots.filter(b => b.online && b.inGuild);

    const fixed = ready.find(b => b.assignedChannelId === voiceChannelId);
    if (fixed) return { ok: true, bot: fixed };

    const here = ready.find(b => b.connectedChannelId === voiceChannelId);
    if (here) return { ok: true, bot: here };

    if (!opts.starting) return { ok: false, reason: "nothing-here" };

    const roaming = ready.filter(b => b.settings.mode === "roaming").sort((a, b) => a.settings.botId.localeCompare(b.settings.botId));
    const free = roaming.find(b => !b.busy);
    if (free) return { ok: true, bot: free };
    return { ok: false, reason: roaming.length ? "busy" : "none" };
}

/** The channels that have a bot right now (fixed ones, and wherever a roaming bot is playing), as mentions. */
export function musicChannels(bots: readonly MusicBotInstance[]): string[] {
    const ids = new Set<string>();
    for (const b of bots) {
        if (!b.online || !b.inGuild) continue;
        if (b.assignedChannelId) ids.add(b.assignedChannelId);
        else if (b.connectedChannelId) ids.add(b.connectedChannelId);
    }
    return [...ids].map(id => `<#${id}>`);
}

/** The sentence for a failed pick, in the server's language. */
export function pickProblem(reason: Exclude<Pick, { ok: true }>["reason"], bots: readonly MusicBotInstance[]): string {
    const where = musicChannels(bots);
    const join = where.length ? L(` Join one of the music channels: ${where.join(" ")}`, ` يرجى الانضمام إلى إحدى رومات الموسيقى: ${where.join(" ")}`) : "";
    switch (reason) {
        case "no-voice":
            return L("🎧 Join a voice channel first.", "🎧 يرجى الانضمام إلى روم صوتية أولاً.") + join;
        case "busy":
            return L("⏳ All music bots are busy right now.", "⏳ جميع بوتات الموسيقى مشغولة حالياً.") + join;
        case "nothing-here":
            return L("Nothing is playing in your voice channel.", "لا يوجد تشغيل في رومك الصوتية.");
        case "none":
            return L("🎧 This voice channel has no music bot.", "🎧 لا يوجد بوت موسيقى في هذه الروم.") + join;
    }
}
