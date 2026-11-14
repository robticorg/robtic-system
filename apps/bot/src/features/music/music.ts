import { defineFeature } from "@typings/feature";

/**
 * Music bots (RobTic Music). The main bot is not a music bot itself: separate bot accounts (added on the RobTic Music
 * dashboard or with `/bot create`, tokens encrypted at rest) which the main bot runs, each locked to this server.
 * A fixed bot has one voice channel; a roaming bot joins whichever channel music is asked for in. People play music
 * with text commands in a voice channel's chat and with the control panel (components/panel.ts).
 *
 * Server admins only — this shows bot accounts and their channels.
 */
export const musicFeature = defineFeature({
    key: "music",
    description: "Music bots: /music list (create and delete with /bot)",
    activation: "default-on",
    commands: [
        {
            name: "music",
            description: "Music bots for this server",
            scope: "guild",
            access: "admin",
            category: "Music",
            subcommands: [
                { name: "list", description: "Every music bot on this server" },
            ],
        },
    ],
    events: ["clientReady", "guildMemberAdd"],
    components: ["music"],
});
