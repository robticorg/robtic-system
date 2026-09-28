/**
 * Deletes the stored data of the features removed from the bot: coins, partner, premium (the bot's
 * Premium Engine — not Minecraft's premium tiers), quests, rejoin roles, reply and tickets.
 *
 *   bun run db:drop-removed-features             # dry run: prints what would be removed
 *   bun run db:drop-removed-features --confirm   # actually removes it — irreversible
 *
 * Removes:
 *   - every collection those features owned (dropped whole);
 *   - their per-guild `/feature` overrides;
 *   - command-access grants and shortcuts that point at their commands.
 *
 * Deliberately kept: PointHistory rows written by quests/premium/coin migration. Those points are
 * still in members' balances, and deleting the rows would leave balances the ledger can't explain.
 */
import mongoose from "mongoose";
import { connectDatabase } from "@database/connection";

/** Mongoose model names; the collection name is derived exactly the way mongoose derived it. */
const REMOVED_MODELS = [
    // coins
    "Coin", "LegacyCoin",
    // partner (the old directory — the new feature uses PartnerServer)
    "Partner",
    // premium (bot Premium Engine)
    "PremiumTier", "PremiumFeatureValue", "PremiumMembership", "PremiumRoleMap", "PremiumSettings",
    // quests
    "Quest", "QuestClaim", "QuestGenerationHistory", "QuestSettings", "QuestStats",
    "CommunityChallenge", "CommunityContribution",
    // rejoin roles
    "RejoinRolesConfig", "SavedRoles",
    // reply
    "Reply",
    // tickets
    "Ticket",
] as const;

// `partner` is not listed: it is a feature again (a new one, in `partnerservers`), and its settings
// and command grants belong to it. Only the old `partners` collection above is dropped.
const REMOVED_FEATURE_KEYS = ["coins", "premium", "quests", "rejoin-roles", "reply"];

const REMOVED_COMMANDS = [
    "coins", "premium", "premium-config", "premium-admin", "quest", "quest-config",
    "rejoin-roles", "reply",
    "ticket-panel", "claim", "close", "rename", "add", "remove", "escalate",
];

const confirm = process.argv.includes("--confirm");

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
}

await connectDatabase(uri);
const db = mongoose.connection.db!;
const pluralize = mongoose.pluralize()!;

const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));

console.log(confirm ? "Removing data of removed features…\n" : "DRY RUN — nothing is changed. Re-run with --confirm to apply.\n");

for (const model of REMOVED_MODELS) {
    const name = pluralize(model);
    if (!existing.has(name)) {
        console.log(`  - ${name}: not present`);
        continue;
    }
    const count = await db.collection(name).countDocuments();
    if (confirm) await db.collection(name).drop();
    console.log(`  ${confirm ? "dropped" : "would drop"} ${name} (${count} documents)`);
}

const commandPattern = new RegExp(`^(${REMOVED_COMMANDS.map(c => c.replace(/[-]/g, "\\-")).join("|")})(\\s|$)`, "i");

const cleanups: Array<{ collection: string; filter: Record<string, unknown>; what: string }> = [
    { collection: pluralize("GuildFeature"), filter: { key: { $in: REMOVED_FEATURE_KEYS } }, what: "feature overrides" },
    { collection: pluralize("CommandAccess"), filter: { commandName: { $in: REMOVED_COMMANDS } }, what: "command-access grants" },
    { collection: pluralize("Shortcut"), filter: { command: commandPattern }, what: "shortcuts" },
];

for (const { collection, filter, what } of cleanups) {
    if (!existing.has(collection)) continue;
    const count = await db.collection(collection).countDocuments(filter);
    if (confirm && count > 0) await db.collection(collection).deleteMany(filter);
    console.log(`  ${confirm ? "deleted" : "would delete"} ${count} ${what} in ${collection}`);
}

await mongoose.connection.close();
console.log(confirm ? "\nDone." : "\nDry run complete.");
