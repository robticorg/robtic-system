const allowedGuildIds = new Set<string>([
    ...(process.env.MainGuild ? [process.env.MainGuild.trim()] : []),
    ...(process.env.TestGuild
        ? process.env.TestGuild.split(",").map((id) => id.trim()).filter(Boolean)
        : []),
]);

export function isAllowedGuild(guildId: string): boolean {
    return allowedGuildIds.has(guildId);
}
