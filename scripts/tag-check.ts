/** Verifies the server-tag role across servers with stubbed guilds and repositories — no database, no gateway. */
import { AllowedGuildRepository, ServerConfigRepository } from "@database/repositories";
import { syncGuildTagRoles, syncMemberTagRole, syncUserTagRoles, wearsWhitelistedTag } from "@bot/features/tag/functions/tag-roles";
import { tagFeature } from "@bot/features/tag/tag";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const S1 = "100000000000000001", S2 = "100000000000000002", S3 = "100000000000000003", S4 = "100000000000000004";
const OUTSIDE = "900000000000000009";
const USER = "500000000000000005";

// Whitelist: servers 1–4. Tag roles: 1 and 3 have one, 2 has none, 4 points at a deleted role.
const allowed = new Set([S1, S2, S3, S4]);
(AllowedGuildRepository as unknown as { isAllowed: (id: string) => Promise<boolean> }).isAllowed = async id => allowed.has(id);
const tagRoles: Record<string, string> = { [S1]: "role-1", [S3]: "role-3", [S4]: "role-gone" };
const config = ServerConfigRepository as unknown as Record<string, unknown>;
// Only server 1 has a log channel.
const logChannels: Record<string, string> = { [S1]: "log-1" };
const setupOf = (guildId: string) => ({ roleId: tagRoles[guildId]!, logChannelId: logChannels[guildId] ?? null });
config.listTagSetups = async () => Object.keys(tagRoles).map(guildId => ({ guildId, ...setupOf(guildId) }));
config.getTagSetup = async (guildId: string) => (tagRoles[guildId] ? setupOf(guildId) : null);

/** Every message posted to a log channel, as `<channel id>: <text>`. */
const logged: string[] = [];

const tag = (identityGuildId: string | null, identityEnabled = true) => ({ identityGuildId, identityEnabled, tag: "RBTC", badge: null });

function fakeUser(primaryGuild: ReturnType<typeof tag> | null, bot = false) {
    return { id: USER, bot, primaryGuild };
}

function fakeGuild(id: string, roleIds: string[], editable = true) {
    const members = new Map<string, any>();
    const logChannel = (channelId: string) => ({
        id: channelId,
        isSendable: () => true,
        send: async (message: any) => void logged.push(`${channelId}: ${message.embeds[0].data.description}`),
    });
    const guild: any = { id, name: `Server ${id.slice(-1)}`, roles: { cache: new Map() }, channels: { cache: new Map([["log-1", logChannel("log-1")]]) }, members: { cache: members, fetch: async (userId?: string) => {
        if (userId === undefined) return members;
        const found = members.get(userId);
        if (!found) throw new Error("Unknown Member");
        return found;
    } } };
    for (const roleId of roleIds) guild.roles.cache.set(roleId, { id: roleId, guild, managed: false, editable, toString: () => `<@&${roleId}>` });
    guild.join = (user: any, has: string[] = []) => {
        const held = new Set(has);
        const member = {
            id: user.id, user, guild,
            client: { guilds: { cache: new Map([[S2, { name: "Server 2" }]]) } },
            toString: () => `<@${user.id}>`,
            roles: {
                cache: { has: (roleId: string) => held.has(roleId) },
                add: async (role: any) => void held.add(role.id),
                remove: async (role: any) => void held.delete(role.id),
            },
            held,
        };
        members.set(user.id, member);
        return member;
    };
    return guild;
}

// Which tags count.
check("a tag of a whitelisted server counts", await wearsWhitelistedTag(fakeUser(tag(S2)) as never));
check("a tag of some other server doesn't", !(await wearsWhitelistedTag(fakeUser(tag(OUTSIDE)) as never)));
check("a tag that is switched off doesn't", !(await wearsWhitelistedTag(fakeUser(tag(S2, false)) as never)));
check("no tag at all doesn't", !(await wearsWhitelistedTag(fakeUser(null) as never)));

// Wearing server 2's tag gives the tag role of every other server.
{
    const g1 = fakeGuild(S1, ["role-1"]), g2 = fakeGuild(S2, []), g3 = fakeGuild(S3, ["role-3"]), g4 = fakeGuild(S4, []);
    const client: any = { guilds: { cache: new Map([[S1, g1], [S2, g2], [S3, g3], [S4, g4]]) } };
    const user = fakeUser(tag(S2));
    const m1 = g1.join(user), m2 = g2.join(user), m4 = g4.join(user);

    await syncUserTagRoles(client, user as never);
    check("server 2's tag → server 1's tag role", m1.held.has("role-1"));
    check("…and it is logged in server 1's log channel: who, which tag, which role",
        logged.length === 1 && logged[0]!.startsWith("log-1: ") && [`<@${USER}>`, "RBTC", "Server 2", "<@&role-1>"].every(part => logged[0]!.includes(part)), logged[0]);
    check("a server with no tag role set up is skipped", m2.held.size === 0);
    check("a server whose tag role was deleted is skipped", m4.held.size === 0);
    check("a server the member isn't in is skipped", !g3.members.cache.has(USER));

    user.primaryGuild = tag(OUTSIDE);
    await syncUserTagRoles(client, user as never);
    check("switching to another server's tag takes the role back", !m1.held.has("role-1"));
    check("…and the removal is logged", logged.length === 2 && logged[1]!.includes("removed"), logged[1]);

    user.primaryGuild = tag(S1);
    await syncUserTagRoles(client, user as never);
    user.primaryGuild = null;
    await syncUserTagRoles(client, user as never);
    check("taking the tag off takes the role back", !m1.held.has("role-1"));

    client.guilds.cache.delete(S1);
    user.primaryGuild = tag(S2);
    await syncUserTagRoles(client, user as never);
    check("a server the bot isn't in is skipped", !m1.held.has("role-1"));
}

// A role the bot can't hand out is left alone.
{
    const g1 = fakeGuild(S1, ["role-1"], false);
    const client: any = { guilds: { cache: new Map([[S1, g1]]) } };
    const user = fakeUser(tag(S2));
    const m1 = g1.join(user);
    await syncUserTagRoles(client, user as never);
    check("a tag role above the bot is skipped, not an error", m1.held.size === 0);
}

// Joining, and the whole-server sync.
{
    const g3 = fakeGuild(S3, ["role-3"]);
    const wearer = g3.join(fakeUser(tag(S1)));
    await syncMemberTagRole(wearer as never);
    check("a member who joins already wearing a tag gets the role", wearer.held.has("role-3"));

    logged.length = 0;
    const quiet = g3.join({ id: "9", bot: false, primaryGuild: tag(S1) });
    await syncMemberTagRole(quiet as never);
    check("a server with no log channel logs nothing, and the role is still given", quiet.held.has("role-3") && logged.length === 0);

    const g1 = fakeGuild(S1, ["role-1"]);
    const a = g1.join({ id: "1", bot: false, primaryGuild: tag(S3) });
    const b = g1.join({ id: "2", bot: false, primaryGuild: null }, ["role-1"]);
    const c = g1.join({ id: "3", bot: true, primaryGuild: tag(S3) });
    const result = await syncGuildTagRoles(g1 as never, setupOf(S1));
    check("server sync: wearers get it, others lose it, bots are ignored",
        a.held.has("role-1") && !b.held.has("role-1") && c.held.size === 0 && result.given === 1 && result.removed === 1);
    check("server sync is logged as one summary, not one message per member",
        logged.length === 1 && logged[0]!.includes("given to **1**") && logged[0]!.includes("removed from **1**"), logged[0]);

    g1.channels.cache.delete("log-1");
    const late = g1.join({ id: "5", bot: false, primaryGuild: tag(S3) });
    await syncMemberTagRole(late as never);
    check("a deleted log channel is ignored — the role is still given", late.held.has("role-1"));

    allowed.delete(S1);
    const d = g1.join({ id: "4", bot: false, primaryGuild: tag(S3) });
    await syncGuildTagRoles(g1 as never, setupOf(S1));
    check("a server off the whitelist is skipped", d.held.size === 0);
    allowed.add(S1);
}

// Manifest.
{
    const command = tagFeature.commands[0];
    const options = command.subcommands[0].options;
    check("/tag setup, with an optional role and an optional log channel",
        command.name === "tag" && command.subcommands[0].name === "setup"
        && options[0].name === "role" && options[1].name === "log" && options.every(option => !("required" in option)));
    check("server admins only", command.access === "admin");
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll tag checks passed.");
process.exit(0);
