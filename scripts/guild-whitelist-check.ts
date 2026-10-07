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
const config = GlobalConfigRepository as unknown as { get: (key: string) => Promise<string | null> };
config.get = async () => ADMIN;

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

delete process.env.COMMAND_GUILD_ID;
const ok = await publishCommands(rest as never, APP, commands as never, "test" as never);
check("production: normal commands registered on the bot (global) — every server it joins has them",
    JSON.stringify(puts.get("global")) === JSON.stringify(["level"]));
check("production: admin commands only in the admin server", JSON.stringify(puts.get(ADMIN)) === JSON.stringify(["system"]));
check("production: old per-server copies cleared (no duplicates in the picker)", JSON.stringify(puts.get(JOINED)) === "[]");
check("production: a whitelisted server the bot isn't in is skipped, not a failure", ok && !puts.has(NOT_JOINED));

puts.clear();
config.get = async () => null;
await publishCommands(rest as never, APP, commands as never, "test" as never);
check("production without an admin server: admin commands published nowhere",
    ![...puts.values()].some(names => names.includes("system")) && JSON.stringify(puts.get("global")) === JSON.stringify(["level"]));

puts.clear();
config.get = async () => ADMIN;
process.env.COMMAND_GUILD_ID = JOINED;
await publishCommands(rest as never, APP, commands as never, "test" as never);
check("development (COMMAND_GUILD_ID): that one server gets them, global emptied",
    JSON.stringify(puts.get(JOINED)) === JSON.stringify(["level"]) && JSON.stringify(puts.get("global")) === "[]");
delete process.env.COMMAND_GUILD_ID;

if (failures > 0) { console.log(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll guild whitelist checks passed.");
process.exit(0);
