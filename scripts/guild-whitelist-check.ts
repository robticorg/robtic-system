/** `<prefix>guild <id> add|remove` argument parsing, and slash command publishing. */
import { Collection } from "discord.js";
import { parseGuildWhitelistArgs } from "../apps/bot/src/commands/admin/guild-whitelist.message";
import { SERVER_WHITELIST_MESSAGES } from "@constants";
import { AllowedGuildRepository, GlobalConfigRepository } from "@database/repositories";
import { publishCommands } from "@core/registration";

let failures = 0;
const check = (name: string, ok: boolean) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failures++;
};
const ID = "1293702554663784561";

// ── Arguments ─────────────────────────────────────────────────────────────────────────────────
check("id then add", JSON.stringify(parseGuildWhitelistArgs(`${ID} add`)) === JSON.stringify({ guildId: ID, action: "add" }));
check("id then remove", parseGuildWhitelistArgs(`${ID} remove`)?.action === "remove");
check("other order accepted", parseGuildWhitelistArgs(`add ${ID}`)?.guildId === ID);
check("case and extra spaces ignored", parseGuildWhitelistArgs(`  ${ID}   ADD `)?.action === "add");
check("missing action → usage", parseGuildWhitelistArgs(ID) === null);
check("unknown action → usage", parseGuildWhitelistArgs(`${ID} delete`) === null);
check("too many words → usage", parseGuildWhitelistArgs(`${ID} add now`) === null);
check("empty → usage", parseGuildWhitelistArgs("") === null);
check("usage uses the server's prefix", SERVER_WHITELIST_MESSAGES.usage("?").includes("`?guild <server id> add`"));

// ── Slash command registration: on the bot (global) ──────────────────────────────────────────
const APP = "999999999999999999";
const ADMIN = "1459856238346244202";
const JOINED = ID;
const NOT_JOINED = "1521603602349822223";

(AllowedGuildRepository as unknown as { list: () => Promise<unknown[]> }).list = async () =>
    [JOINED, NOT_JOINED, ADMIN].map(guildId => ({ guildId }));

const stored = new Map<string, string>();
const config = GlobalConfigRepository as unknown as { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> };
config.get = async key => stored.get(key) ?? null;
config.set = async (key, value) => void stored.set(key, value);

const command = (name: string, scope?: string) => ({ scope, data: { toJSON: () => ({ name, description: name }) } });
const commands = new Collection<string, unknown>([
    ["level", command("level")],
    ["system", command("system", "admin")],
]);

const puts = new Map<string, string[]>();
const rest = {
    async put(route: string, { body }: { body: Array<{ name: string }> }) {
        const guild = /guilds\/(\d+)/.exec(route)?.[1];
        if (guild === NOT_JOINED) throw Object.assign(new Error("Missing Access"), { code: 50001 });
        puts.set(guild ?? "global", body.map(c => c.name));
    },
    async get() { return [{ name: "level" }]; },
};

const ok = await publishCommands(rest as never, APP, commands as never, "test" as never);
check("every command, admin scope included, is registered on the bot (global)",
    JSON.stringify(puts.get("global")) === JSON.stringify(["level", "system"]));
check("no command is registered on a guild", [...puts].every(([route, names]) => route === "global" || names.length === 0));
check("old per-server copies cleared, the old admin server included (no duplicates in the picker)",
    JSON.stringify(puts.get(JOINED)) === "[]" && JSON.stringify(puts.get(ADMIN)) === "[]");
check("a whitelisted server the bot isn't in is skipped, not a failure", ok && !puts.has(NOT_JOINED));

puts.clear();
process.env.COMMAND_GUILD_ID = JOINED;
await publishCommands(rest as never, APP, commands as never, "test" as never);
check("COMMAND_GUILD_ID no longer moves commands onto a guild",
    JSON.stringify(puts.get("global")) === JSON.stringify(["level", "system"]) && !puts.has(JOINED));
delete process.env.COMMAND_GUILD_ID;
check("after the one-time cleanup a publish is a single request to the bot — no guild is touched",
    puts.size === 1 && puts.has("global"));

if (failures > 0) { console.log(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll guild whitelist checks passed.");
process.exit(0);
