import "./_english";
import { emoji, setGuildEmojiLookup } from "@config/emojis";
import { runWithLang } from "@utils/lang-context";

// Which emoji wins: the server's own (dashboard → Emojis), then the admin console's, then the bot's default.
let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failures++; };

setGuildEmojiLookup((guildId, key) => (guildId === "111" && key === "top_text" ? "<:chat:123456789012345678>" : undefined));
check("outside a server: the default", emoji("top_text") === "💬");
check("in a server with its own: the server's", runWithLang("en", () => emoji("top_text"), "111") === "<:chat:123456789012345678>");
check("in a server, another slot: the default", runWithLang("en", () => emoji("top_voice"), "111") === "🎙️");
check("in another server: the default", runWithLang("en", () => emoji("top_text"), "222") === "💬");
check("survives an await", await runWithLang("en", async () => { await Bun.sleep(1); return emoji("top_text"); }, "111") === "<:chat:123456789012345678>");

if (failures) { console.log(`\n${failures} check(s) failed.`); process.exit(1); }
console.log("\nAll emoji checks passed.");
