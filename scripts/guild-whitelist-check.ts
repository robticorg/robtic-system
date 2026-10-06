/** `<prefix>guild <id> add|remove` argument parsing. */
import { parseGuildWhitelistArgs } from "../apps/bot/src/commands/admin/guild-whitelist.message";
import { SERVER_WHITELIST_MESSAGES } from "@constants";

let failures = 0;
const check = (name: string, ok: boolean) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failures++;
};
const ID = "1293702554663784561";

check("id then add", JSON.stringify(parseGuildWhitelistArgs(`${ID} add`)) === JSON.stringify({ guildId: ID, action: "add" }));
check("id then remove", parseGuildWhitelistArgs(`${ID} remove`)?.action === "remove");
check("other order accepted", parseGuildWhitelistArgs(`add ${ID}`)?.guildId === ID);
check("case and extra spaces ignored", parseGuildWhitelistArgs(`  ${ID}   ADD `)?.action === "add");
check("missing action → usage", parseGuildWhitelistArgs(ID) === null);
check("unknown action → usage", parseGuildWhitelistArgs(`${ID} delete`) === null);
check("too many words → usage", parseGuildWhitelistArgs(`${ID} add now`) === null);
check("empty → usage", parseGuildWhitelistArgs("") === null);
check("usage uses the server's prefix", SERVER_WHITELIST_MESSAGES.usage("?").includes("`?guild <server id> add`"));

if (failures > 0) { console.log(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll guild whitelist checks passed.");
