import type { ProfileSearchResult } from "@typings/profile";
import { ActivityRepository, UserRepository } from "@database/repositories";
import { PROFILE_SEARCH_LIMIT, SNOWFLAKE_REGEX } from "@constants";
import { calculateLevel } from "@core/xp";

/**
 * Autocomplete backing for the Activity's profile search. Matches an exact user id first, then
 * falls back to a case-insensitive username prefix/substring match over members with recorded
 * activity in the guild.
 */
export async function searchProfiles(
    guildId: string,
    query: string,
    limit = PROFILE_SEARCH_LIMIT,
): Promise<ProfileSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const records = SNOWFLAKE_REGEX.test(trimmed)
        ? await ActivityRepository.findByDiscordId(guildId, trimmed)
        : await ActivityRepository.searchByUsername(guildId, trimmed, limit);

    return Promise.all(records.map(async (record) => ({
        discordId: record.discordId,
        username: record.username,
        displayName: await UserRepository.getDisplayName(record.discordId) ?? record.username,
        avatarUrl: null,
        level: calculateLevel(record.totalXP),
    })));
}
