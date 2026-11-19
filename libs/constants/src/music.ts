import type { PermissionsString } from "discord.js";

/**
 * Music bots (added on the Robtic Voice dashboard): separate bot accounts the main bot runs, each locked to one server
 * and one voice channel. Ported from the standalone RobTic Music bot.
 */
export const MUSIC_CONFIG = {
    // The words each text command answers to are per server now (RobTic Music dashboard → General); the defaults
    // are DEFAULT_MUSIC_WORDS in MusicSettingsRepository.
    defaultVolume: 100,
    maxVolume: 150,
    volumeStep: 10,
    /** How often the now-playing banner redraws its progress bar. */
    progressUpdateSeconds: 5,
    embedColor: 0x1793ff,
    /** The progress bar on the now-playing banner. */
    barColor: "#1793ff",
    /** Branding drawn at the bottom of the now-playing banner. */
    bannerTitle: "RobTic Music",
    bannerSubtitle: "robtic.org",
    statusRotation: ["RobTic Music", "robtic.org"],
    statusIntervalSeconds: 5,
    /** A bot that isn't staying in its channel leaves this long after the music ends. */
    idleLeaveSeconds: 120,
    /** How often the running music bots are compared with the saved ones (new, removed, moved, restarted). */
    syncSeconds: 15,
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
