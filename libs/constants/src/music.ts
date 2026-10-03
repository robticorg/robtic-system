import type { PermissionsString } from "discord.js";

/**
 * Music bots (`/music create`): separate bot accounts the main bot runs, each locked to one server
 * and one voice channel. Ported from the standalone RobTic Music bot.
 */
export const MUSIC_CONFIG = {
    /** Text triggers, typed in the voice channel's chat by someone in that voice channel. */
    playPrefixes: ["ش", "شغل"],
    stopPrefixes: ["وقف"],
    volumePrefixes: ["صوت"],
    defaultVolume: 100,
    maxVolume: 150,
    volumeStep: 10,
    /** How often the now-playing banner redraws its progress bar. */
    progressUpdateSeconds: 5,
    embedColor: 0x310c2d,
    /** Branding drawn at the bottom of the now-playing banner. */
    bannerTitle: "by virus",
    bannerSubtitle: "thisvirus",
    statusRotation: ["by thisvirus", "myvirus.site.je"],
    statusIntervalSeconds: 5,
    /** Most music bots one server may have. */
    maxBotsPerGuild: 10,
    /** Suggestions shown in the now-playing select menu, and past tracks kept for "previous". */
    suggestionCount: 5,
    historyLimit: 20,
    /**
     * What a music bot is allowed to do — granted on its own voice channel only, as a member
     * overwrite. It is invited with no server-wide permissions at all.
     */
    channelPermissions: [
        "ViewChannel",
        "Connect",
        "Speak",
        "UseVAD",
        "SendMessages",
        "EmbedLinks",
        "AttachFiles",
        "ReadMessageHistory",
    ] satisfies PermissionsString[],
} as const;
