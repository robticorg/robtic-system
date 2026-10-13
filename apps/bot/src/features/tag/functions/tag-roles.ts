import { EmbedBuilder, type Client, type Guild, type GuildMember, type Role, type User } from "discord.js";
import { COLORS } from "@constants";
import { isFeatureEnabled } from "@core/features";
import { AllowedGuildRepository, ServerConfigRepository } from "@database/repositories";
import { Logger } from "@logger";

const CTX = "tag";

/** A server's `/tag setup`: the role, and where changes are logged (optional). */
export interface TagSetup {
    roleId: string;
    logChannelId: string | null;
}

/** Whether the user is wearing the server tag of a whitelisted server. A tag from anywhere else doesn't count. */
export async function wearsWhitelistedTag(user: Pick<User, "primaryGuild">): Promise<boolean> {
    const tag = user.primaryGuild;
    if (!tag?.identityEnabled || !tag.identityGuildId) return false;
    return AllowedGuildRepository.isAllowed(tag.identityGuildId);
}

/** Why the bot can't hand `role` out, or `null` when it can. */
export function tagRoleProblem(role: Role): string | null {
    if (role.id === role.guild.id) return "`@everyone` can't be the tag role.";
    if (role.managed) return `${role} is managed by an integration — pick a normal role.`;
    if (!role.editable) return `I can't give ${role} — it must be below my highest role, and I need **Manage Roles**.`;
    return null;
}

/**
 * The server's tag role if the bot can hand it out right now. A deleted role, one above the bot,
 * a server that isn't whitelisted or has the feature off — all `null`, and the server is skipped.
 */
async function usableTagRole(guild: Guild, roleId: string): Promise<Role | null> {
    if (!(await AllowedGuildRepository.isAllowed(guild.id)) || !(await isFeatureEnabled(guild.id, "tag"))) return null;
    const role = guild.roles.cache.get(roleId);
    return role && !tagRoleProblem(role) ? role : null;
}

/** Adds or removes the role so it matches `wears`. `true` when something changed. */
async function matchTagRole(member: GuildMember, role: Role, wears: boolean): Promise<boolean> {
    if (member.user.bot || member.roles.cache.has(role.id) === wears) return false;
    try {
        if (wears) await member.roles.add(role, "Wears a server tag");
        else await member.roles.remove(role, "No longer wears a server tag");
        return true;
    } catch (err) {
        Logger.warn(`Could not ${wears ? "give" : "remove"} the tag role for ${member.id} in ${member.guild.id}: ${err}`, CTX);
        return false;
    }
}

/** Posts to the server's tag log, if one is set and still usable. Never throws — a log must not stop a role. */
async function postTagLog(guild: Guild, logChannelId: string | null, color: number, description: string): Promise<void> {
    if (!logChannelId) return;
    try {
        const channel = guild.channels.cache.get(logChannelId);
        if (!channel?.isSendable()) return;
        await channel.send({
            embeds: [new EmbedBuilder().setColor(color).setDescription(description).setTimestamp()],
            allowedMentions: { parse: [] },
        });
    } catch (err) {
        Logger.warn(`Could not post to the tag log in ${guild.id}: ${err}`, CTX);
    }
}

/** One member's role changed: "who, which tag, which role". */
async function logMemberChange(member: GuildMember, role: Role, wears: boolean, logChannelId: string | null): Promise<void> {
    if (!logChannelId) return;
    const tag = member.user.primaryGuild;
    const from = wears && tag?.identityGuildId
        ? ` \`${tag.tag ?? "tag"}\` of **${member.client.guilds.cache.get(tag.identityGuildId)?.name ?? tag.identityGuildId}**`
        : "";
    await postTagLog(
        member.guild,
        logChannelId,
        wears ? COLORS.success : COLORS.warning,
        wears
            ? `🏷️ ${member} (\`${member.id}\`) wears the server tag${from} — given ${role}.`
            : `🏷️ ${member} (\`${member.id}\`) no longer wears a server tag — ${role} removed.`,
    );
}

/** Matches one member's role and logs it if it changed. */
async function applyToMember(member: GuildMember, role: Role, wears: boolean, logChannelId: string | null): Promise<boolean> {
    const changed = await matchTagRole(member, role, wears);
    if (changed) await logMemberChange(member, role, wears, logChannelId);
    return changed;
}

/** One user changed their tag: update their tag role in every server that has one set up. */
export async function syncUserTagRoles(client: Client, user: User): Promise<void> {
    if (user.bot) return;
    const wears = await wearsWhitelistedTag(user);

    for (const { guildId, roleId, logChannelId } of await ServerConfigRepository.listTagSetups()) {
        const guild = client.guilds.cache.get(guildId);
        const role = guild && await usableTagRole(guild, roleId);
        if (!guild || !role) continue;

        const member = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
        if (member) await applyToMember(member, role, wears, logChannelId);
    }
}

/** One member joined: give them this server's tag role if they already wear a tag. */
export async function syncMemberTagRole(member: GuildMember): Promise<void> {
    if (member.user.bot) return;
    const setup = await ServerConfigRepository.getTagSetup(member.guild.id);
    const role = setup && await usableTagRole(member.guild, setup.roleId);
    if (setup && role) await applyToMember(member, role, await wearsWhitelistedTag(member.user), setup.logChannelId);
}

/**
 * Every member of one server: wearers get the role, everyone else loses it. Logged as one summary
 * line rather than one message per member — a first setup can change hundreds at once.
 */
export async function syncGuildTagRoles(guild: Guild, setup: TagSetup): Promise<{ given: number; removed: number }> {
    const role = await usableTagRole(guild, setup.roleId);
    if (!role) return { given: 0, removed: 0 };

    let given = 0, removed = 0;
    for (const member of (await guild.members.fetch()).values()) {
        const wears = await wearsWhitelistedTag(member.user);
        if (!(await matchTagRole(member, role, wears))) continue;
        if (wears) given++;
        else removed++;
    }

    if (given || removed) {
        await postTagLog(guild, setup.logChannelId, COLORS.info, `🏷️ Tag role sync — ${role} given to **${given}**, removed from **${removed}**.`);
    }
    return { given, removed };
}

/** On start: catches every tag put on or taken off while the bot was offline. */
export async function syncAllTagRoles(client: Client): Promise<void> {
    for (const { guildId, ...setup } of await ServerConfigRepository.listTagSetups()) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        try {
            const { given, removed } = await syncGuildTagRoles(guild, setup);
            if (given || removed) Logger.info(`Tag role in ${guildId}: given to ${given}, removed from ${removed}`, CTX);
        } catch (err) {
            Logger.warn(`Tag role sync failed in ${guildId}: ${err}`, CTX);
        }
    }
}
