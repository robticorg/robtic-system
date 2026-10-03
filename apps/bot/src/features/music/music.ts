import { defineFeature } from "@typings/feature";

/**
 * Music bots. The main bot is not a music bot itself: `/music create` registers a separate bot
 * account (its token, encrypted at rest) which the main bot then runs as a 24/7 music bot, locked
 * to this server and one voice channel. `/music list` shows them; `/bot remove` deletes one.
 *
 * Server admins only — this hands out bot tokens and channel permissions. `modalOnly` because
 * `create` opens a modal, which the prefix stand-in can't show.
 */
export const musicFeature = defineFeature({
    key: "music",
    description: "Music bots: /music create|list, /bot remove",
    activation: "default-on",
    commands: [
        {
            name: "music",
            description: "Music bots for this server",
            scope: "guild",
            access: "admin",
            category: "Music",
            modalOnly: true,
            subcommands: [
                { name: "create", description: "Add a music bot: its token, name and voice channel" },
                { name: "list", description: "Every music bot on this server" },
            ],
        },
        {
            name: "bot",
            description: "Manage this server's music bots",
            scope: "guild",
            access: "admin",
            category: "Music",
            subcommands: [
                {
                    name: "remove",
                    description: "Remove a music bot: it goes offline and leaves the server",
                    options: [
                        { name: "bot", description: "Which music bot", type: "string", required: true, autocomplete: true },
                    ],
                },
            ],
        },
    ],
    events: ["clientReady", "guildMemberAdd"],
    components: ["music"],
});
