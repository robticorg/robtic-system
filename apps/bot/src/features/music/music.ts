import { defineFeature } from "@typings/feature";

/**
 * Music bots. The main bot is not a music bot itself: `/bot create` (the `bots` feature) registers
 * a separate bot account (its token, encrypted at rest) which the main bot then runs as a 24/7
 * music bot, locked to this server and one voice channel. `/music list` shows them; `/bot delete`
 * deletes one.
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
});
