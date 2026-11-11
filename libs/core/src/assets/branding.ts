/**
 * Robtic's built-in look (images/level.png, images/line.png, the partner banner, the Robtic boost wording) belongs to
 * Robtic's own servers. Every other server sets its own from the dashboard and gets nothing branded by default.
 * ROBTIC_BRANDED_GUILD_IDS: comma-separated server ids that keep the built-in assets.
 */
const BRANDED = new Set((process.env.ROBTIC_BRANDED_GUILD_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean));

export function isBrandedGuild(guildId: string | null | undefined): boolean {
    return Boolean(guildId) && BRANDED.has(guildId!);
}
