import { defineFeature } from "@typings/feature";

/**
 * Extra bots the main bot sets up: `/bot create` opens one form whose first field picks the type —
 * a **music** bot (run here, locked to this server and one voice channel) or the **Minecraft** bot
 * (sent to the Minecraft API, which saves its token encrypted and keeps it running). `/bot delete`
 * opens a form listing the bots that exist.
 *
 * Server admins only. The Minecraft bot is one per deployment, so it is further limited to the
 * bot owner and super users. `modalOnly` because both subcommands open a modal.
 */
export const botsFeature = defineFeature({
    key: "bots",
    description: "Music and Minecraft bots: /bot create|delete",
    activation: "default-on",
    commands: [
        {
            name: "bot",
            description: "Create or delete this server's extra bots",
            scope: "guild",
            access: "admin",
            category: "Music",
            modalOnly: true,
            subcommands: [
                { name: "create", description: "Add a bot — music or Minecraft — from its token" },
                { name: "delete", description: "Delete a bot: it goes offline and its token is deleted" },
            ],
        },
    ],
    components: ["bots"],
});
