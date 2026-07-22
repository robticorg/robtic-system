/** Text for the admin `/check` (a.k.a. `!check`) lookup command. */
export const CHECK_MESSAGES = {
    adminOnly: "❌ Only administrators can use this command.",
    guildOnly: "This command can only be used in a server.",
    invalidValue: "Please provide a whole number of 1 or greater.",

    streakTitle: (value: number) => `🔥 Members with a ${value}-day streak`,
    streakNone: (value: number) => `No members currently have a **${value}-day** streak.`,
    streakSummary: (count: number, value: number) =>
        `**${count}** member${count === 1 ? "" : "s"} currently on a **${value}-day** streak:`,
    streakLine: (rank: number, discordId: string) => `**${rank}.** <@${discordId}>`,
    truncatedNote: (shown: number, total: number) => `\n\n…and ${total - shown} more (showing first ${shown}).`,
} as const;

/** Maximum members listed in one `/check` result before the list is truncated. */
export const CHECK_RESULT_LIMIT = 50;
