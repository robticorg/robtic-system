import { defineFeature } from "@typings/feature";

/**
 * Daily message streaks.
 *
 * `default-on`: Streaks is a Robtic plugin, installed by default (Server → Plugins on the dashboard). It
 * still only counts in channels a guild nominates, so nothing posts, hands out a role or DMs anyone
 * until a server picks its streak channels.
 *
 * Three top-level member commands rather than one `/streak <sub>`: every `ServerConfig.shortcuts`
 * row and every muscle-memory `!streak-top` in existing servers names them individually. Settings
 * and rewards are edited on the dashboard (Community → Streaks); /streak-config and /streak-reward
 * were removed.
 */
export const streakFeature = defineFeature({
    key: "streak",
    description: "Daily message streaks",
    activation: "default-on",
    commands: [
        {
            name: "streak",
            description: "View your (or another member's) daily streak",
            scope: "guild",
            access: "general",
            category: "Streak",
            options: [
                { name: "user", description: "The user to view (defaults to yourself)", type: "user" },
            ],
        },
        {
            name: "streak-top",
            description: "View the top 5 daily streaks",
            scope: "guild",
            access: "general",
            category: "Streak",
        },
        {
            name: "streak-return",
            description: "Give a member their expired streak back (staff only)",
            scope: "guild",
            access: "general",
            category: "Streak",
            options: [
                { name: "user", description: "The member whose streak to return", type: "user", required: true },
            ],
        },
    ],
    events: ["messageCreate", "guildMemberUpdate", "clientReady"],
    components: ["streak"],
});
