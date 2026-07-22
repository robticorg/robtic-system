import { SuperUserRepository } from "@database/repositories";
import { FULL_POWER_ROLE_IDS } from "@constants";
import { discordBotGet } from "./discord-api";

const ADMINISTRATOR = 1n << 3n;
const CACHE_TTL_MS = 60 * 1000;

interface GuildInfo { owner_id: string }
interface MemberInfo { roles: string[] }
interface RoleInfo { id: string; permissions: string }

const cache = new Map<string, { isAdmin: boolean; expiresAt: number }>();

/**
 * Admin gate for the config panel. True when the caller is a whitelisted super user, holds one of
 * the branch's full-power roles, is the guild owner, or holds a role with the Administrator
 * permission. Mirrors the bot's hasFullPower + Administrator checks. Resolved via the bot token —
 * the client can't assert this itself. Cached briefly so repeated panel loads don't hammer Discord.
 */
export async function isGuildAdmin(guildId: string, userId: string): Promise<boolean> {
    if (await SuperUserRepository.isWhitelisted(userId)) return true;

    const cacheKey = `${guildId}:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.isAdmin;

    const isAdmin = await resolveGuildAdmin(guildId, userId);
    cache.set(cacheKey, { isAdmin, expiresAt: Date.now() + CACHE_TTL_MS });
    return isAdmin;
}

async function resolveGuildAdmin(guildId: string, userId: string): Promise<boolean> {
    const [guild, member, roles] = await Promise.all([
        discordBotGet<GuildInfo>(`/guilds/${guildId}`),
        discordBotGet<MemberInfo>(`/guilds/${guildId}/members/${userId}`),
        discordBotGet<RoleInfo[]>(`/guilds/${guildId}/roles`),
    ]);

    if (!guild || !member || !roles) return false;
    if (guild.owner_id === userId) return true;
    if (member.roles.some(roleId => FULL_POWER_ROLE_IDS.includes(roleId))) return true;

    const permissionByRole = new Map(roles.map(role => [role.id, BigInt(role.permissions)]));
    // @everyone (id === guildId) always applies, plus each role the member holds.
    const applicable = [guildId, ...member.roles];

    return applicable.some(roleId => {
        const perms = permissionByRole.get(roleId);
        return perms !== undefined && (perms & ADMINISTRATOR) === ADMINISTRATOR;
    });
}
