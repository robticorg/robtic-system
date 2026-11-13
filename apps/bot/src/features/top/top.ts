import { defineFeature } from "@typings/feature";
import { TOP_CATEGORIES } from "@constants";

/**
 * The leaderboards.
 *
 * Bare `/top` shows the text and voice boards, five ranks a page, with the server's activity chart
 * (Wolf Manager's layout); naming a board shows it ten ranks a page. The caller's own rank shows
 * either way. `#top day|week|month|all` picks the period.
 *
 * `default-on` because it only reads data other features already collect.
 */
export const topFeature = defineFeature({
    key: "top",
    description: "Leaderboards",
    activation: "default-on",
    commands: [
        {
            name: "top",
            description: "Leaderboards — all of them, or one in depth",
            scope: "guild",
            access: "general",
            category: "Leaderboard",
            options: [
                {
                    name: "category",
                    description: "Show just this board, in depth. Leave empty for all of them.",
                    type: "string",
                    choices: TOP_CATEGORIES.map(c => ({ name: c, value: c })),
                },
                {
                    name: "period",
                    description: "Today (default), this week, this month or all time.",
                    type: "string",
                    choices: [
                        { name: "today", value: "day" },
                        { name: "this week", value: "week" },
                        { name: "this month", value: "month" },
                        { name: "all time", value: "all" },
                    ],
                },
            ],
        },
    ],
    components: ["top"],
});
