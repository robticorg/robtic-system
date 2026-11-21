import { defineFeature } from "@typings/feature";

/**
 * The activity economy: Points earned by participating.
 *
 * Points are the Discord-side currency every activity system pays into — messages, combo, streak,
 * voice, and whatever is added next.
 *
 * `default-on`: members accrue Points from activity that is already happening, and nothing is
 * spent or announced without someone asking for it.
 */
export const pointsFeature = defineFeature({
    key: "points",
    description: "Activity points",
    activation: "default-on",
    commands: [
        {
            name: "points",
            description: "Points earned from activity",
            scope: "guild",
            access: "general",
            category: "Economy",
            subcommands: [
                {
                    name: "balance",
                    description: "See your points and rank (or another member's)",
                    options: [{ name: "user", description: "Member to check (defaults to yourself)", type: "user" }],
                },
                { name: "rates", description: "How points are earned here" },
                { name: "history", description: "Your recent point activity" },
                {
                    name: "add",
                    description: "Grant points to a member (admins only)",
                    options: [
                        { name: "user", description: "Member to credit", type: "user", required: true },
                        { name: "amount", description: "How many points", type: "integer", required: true, minValue: 1 },
                        { name: "reason", description: "Why", type: "string" },
                    ],
                },
                {
                    name: "remove",
                    description: "Deduct points from a member (admins only)",
                    options: [
                        { name: "user", description: "Member to debit", type: "user", required: true },
                        { name: "amount", description: "How many points", type: "integer", required: true, minValue: 1 },
                        { name: "reason", description: "Why", type: "string" },
                    ],
                },
            ],
        },
    ],
});
