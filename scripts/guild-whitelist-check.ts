/** `<prefix>guild <id> add|remove`: argument parsing and per-server slash command registration. */
import { Collection } from "discord.js";
import { parseGuildWhitelistArgs } from "../apps/bot/src/commands/admin/guild-whitelist.message";
import { SERVER_WHITELIST_MESSAGES } from "@constants";
import { AllowedGuildRepository, GlobalConfigRepository } from "@database/repositories";
import { clearGuildCommands, publishCommands, publishGuildCommands } from "@core/registration";

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

// ── Slash command registration per whitelisted server ─────────────────────────────────────────
const APP = "999999999999999999";
const ADMIN = "1459856238346244202";
const JOINED = ID;
const NOT_JOINED = "1521603602349822223";

(AllowedGuildRepository as unknown as { list: () => Promise<unknown[]> }).list = async () =>
    [JOINED, NOT_JOINED, ADMIN].map(guildId => ({ guildId }));
(GlobalConfigRepository as unknown as { get: (key: string) => Promise<string | null> }).get = async () => ADMIN;

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
    async get() { return [{ name: "level" }]; }, // a stale global copy
};

delete process.env.COMMAND_GUILD_ID;
const ok = await publishCommands(rest as never, APP, commands as never, "test" as never);
check("deploy: every joined whitelisted server gets the commands", JSON.stringify(puts.get(JOINED)) === JSON.stringify(["level"]));
check("deploy: the admin server also gets the admin commands", JSON.stringify(puts.get(ADMIN)) === JSON.stringify(["level", "system"]));
check("deploy: a server the bot hasn't joined is skipped, not a failure", ok && !puts.has(NOT_JOINED));
check("deploy: stale global copies cleared", JSON.stringify(puts.get("global")) === "[]");

puts.clear();
check("!guild add: registers that one server now",
    (await publishGuildCommands(rest as never, APP, commands as never, "test" as never, JOINED)) === "published" && puts.get(JOINED)?.length === 1);
check("!guild add before the bot joined: registers on join instead",
    (await publishGuildCommands(rest as never, APP, commands as never, "test" as never, NOT_JOINED)) === "not-joined");
await clearGuildCommands(rest as never, APP, "test" as never, JOINED);
check("!guild remove: the server's commands are cleared", JSON.stringify(puts.get(JOINED)) === "[]");

process.env.COMMAND_GUILD_ID = JOINED;
check("development (COMMAND_GUILD_ID): per-server registration is off",
    (await publishGuildCommands(rest as never, APP, commands as never, "test" as never, NOT_JOINED)) === "dev-mode");
delete process.env.COMMAND_GUILD_ID;

if (failures > 0) { console.log(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll guild whitelist checks passed.");
process.exit(0);
