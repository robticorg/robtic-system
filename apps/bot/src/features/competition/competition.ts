import { defineFeature } from "@typings/feature";

/**
 * TEMP — competition bot. Delete this whole folder when the competition is over: see ./README.md.
 *
 * `/create bot token:` registers a separate bot account that the main bot runs (like music bots).
 * That bot has prefix commands only: `!register`, `!start`, `!end`, `!dm`, `!check`, … `modalOnly`
 * keeps `/create` off the prefix path, so a token is never typed into a channel.
 */
export const competitionFeature = defineFeature({
    key: "competition",
    description: "TEMP competition bot: /create bot token:",
    activation: "default-on",
    commands: [
        {
            name: "create",
            description: "Create the competition bot for this server",
            scope: "guild",
            access: "admin",
            category: "Admin",
            modalOnly: true,
            subcommands: [
                {
                    name: "bot",
                    description: "Run a competition bot from its token (replaces this server's current one)",
                    options: [
                        { name: "token", description: "The bot's token (Developer Portal → Bot → Reset Token)", type: "string", required: true },
                    ],
                },
            ],
        },
    ],
    events: ["clientReady"],
});
