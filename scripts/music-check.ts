/** Verifies music-bot token encryption, token checks, the invite link, the create form, the manifest and the create service — no database, no gateway. */
import "./_english";
import { randomBytes } from "node:crypto";
import { ChannelType, ComponentType, PermissionFlagsBits } from "discord.js";
import { generateDependencyReport } from "@discordjs/voice";
import { MUSIC_CONFIG } from "@constants";
import { createMusicBot, parseMusicCommand, pickBot, pickProblem, youtubeIdOf, decryptToken, encryptToken, inspectBotToken, looksLikeBotToken, musicBotInviteUrl, musicTokenKey, type CreateMusicBotInput } from "@core/music";
import { MusicBotRepository, resolveMusicSettings } from "@database/repositories";
import { isDisallowedIntents } from "@core/music/engine/music-bot-instance";
import { BOT_CREATE_MODAL_ID, BOT_DELETE_MODAL_ID, buildBotCreateModal, buildBotDeleteModal } from "@bot/features/bots/utils/forms";
import { musicFeature } from "@bot/features/music/music";
import { botsFeature } from "@bot/features/bots/bots";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

// A made-up token in the right shape — never a real one.
const FAKE_TOKEN = `${"A".repeat(26)}.${"B".repeat(6)}.${"C".repeat(38)}`;

// Encryption at rest.
{
    const key = randomBytes(32);
    const stored = encryptToken(FAKE_TOKEN, key);
    check("the stored value never contains the token", !stored.includes(FAKE_TOKEN) && !stored.includes("AAAAAAAAAA"));
    check("decrypts back to the token with the right key", decryptToken(stored, key) === FAKE_TOKEN);
    check("a different key can't decrypt it", decryptToken(stored, randomBytes(32)) === null);
    check("each encryption is different (random IV)", encryptToken(FAKE_TOKEN, key) !== stored);

    const [v, iv, tag, data] = stored.split(":");
    const tampered = [v, iv, tag, Buffer.from("x" + Buffer.from(data!, "base64").toString("latin1"), "latin1").toString("base64")].join(":");
    check("a tampered value is rejected, not decrypted wrong", decryptToken(tampered, key) === null);
    check("garbage is rejected", decryptToken("not-a-token", key) === null);

    check("key: 64 hex characters", musicTokenKey("a".repeat(64))?.length === 32);
    check("key: 32 bytes of base64", musicTokenKey(randomBytes(32).toString("base64"))?.length === 32);
    check("key: missing → no key (music bots refuse to start)", musicTokenKey("") === null && musicTokenKey(undefined) === null);
    check("key: wrong length → no key", musicTokenKey("abcd") === null);
}

// Token checks before any request.
{
    check("a bot-token shape is accepted", looksLikeBotToken(FAKE_TOKEN));
    check("junk is refused", !looksLikeBotToken("hello") && !looksLikeBotToken("a.b.c") && !looksLikeBotToken(""));
}

// Token inspection against a fake Discord API.
await (async () => {
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    const fakeFetch = (user: unknown, ok = true) => (async (url: string | URL | Request) =>
        !ok ? reply(401, {}) : String(url).includes("applications") ? reply(200, { id: "222" }) : reply(200, user)) as typeof fetch;

    const bot = await inspectBotToken(FAKE_TOKEN, fakeFetch({ id: "111", username: "Robtic Music", bot: true }));
    check("a valid bot token resolves to its bot and application", bot?.botId === "111" && bot.applicationId === "222");
    check("a user (non-bot) token is refused", await inspectBotToken(FAKE_TOKEN, fakeFetch({ id: "111", username: "me" })) === null);
    check("a rejected token is refused", await inspectBotToken(FAKE_TOKEN, fakeFetch({}, false)) === null);
})();

// Invite: no permissions, locked to the server.
{
    const url = new URL(musicBotInviteUrl("222", "999"));
    check("invite asks for no permissions at all", url.searchParams.get("permissions") === "0");
    check("invite is for the bot scope only", url.searchParams.get("scope") === "bot");
    check("invite is locked to this server", url.searchParams.get("guild_id") === "999" && url.searchParams.get("disable_guild_select") === "true");
}

// What it's granted on its own voice channel — and nothing that manages anything.
{
    const perms: readonly string[] = MUSIC_CONFIG.channelPermissions;
    check("can join, speak and chat in its channel", ["ViewChannel", "Connect", "Speak", "SendMessages"].every(p => perms.includes(p)));
    check("gets no management permissions", !perms.some(p => /Manage|Administrator|Kick|Ban|Mention|Move|Mute|Deafen/.test(p)));
}

// The /bot create form.
{
    const modal = buildBotCreateModal().toJSON() as any;
    const inner = modal.components.map((label: any) => label.component);
    check("form id matches its handler", modal.custom_id === BOT_CREATE_MODAL_ID);
    check("asks for type, token, name and channel", inner.length === 4);
    check("the type is a select of music and minecraft", inner[0].type === ComponentType.StringSelect
        && JSON.stringify(inner[0].options.map((o: any) => o.value)) === JSON.stringify(["music", "minecraft"]));
    check("the channel picker shows voice channels only", inner[3].type === ComponentType.ChannelSelect
        && JSON.stringify(inner[3].channel_types) === JSON.stringify([ChannelType.GuildVoice]), JSON.stringify(inner[3].channel_types));
    check("at most one channel, optional (minecraft needs none)", inner[3].min_values === 0 && inner[3].max_values === 1 && inner[3].required === false);
}

// The /bot delete form.
{
    const modal = buildBotDeleteModal([
        { value: "music:1", label: "Music One", description: "Music · 1", emoji: "🎵" },
        { value: "minecraft", label: "Robtic MC", description: "Minecraft · online", emoji: "⛏️" },
    ]).toJSON() as any;
    const select = modal.components[0].component;
    check("delete form id matches its handler", modal.custom_id === BOT_DELETE_MODAL_ID);
    check("lists every existing bot", JSON.stringify(select.options.map((o: any) => o.value)) === JSON.stringify(["music:1", "minecraft"]));
}

// Manifest.
{
    const music = musicFeature.commands.find(c => c.name === "music")!;
    const bot = botsFeature.commands.find(c => c.name === "bot")!;
    check("/music list", music.subcommands.some(x => x.name === "list"));
    check("/bot create and /bot delete", ["create", "delete"].every(s => bot.subcommands.some(x => x.name === s)));
    check("/bot opens modals", bot.modalOnly === true);
    check("server admins only", [...musicFeature.commands, ...botsFeature.commands].every(c => c.access === "admin"));
}

// Voice runtime: what @discordjs/voice can find for encryption, Opus and DAVE.
{
    const report = generateDependencyReport();
    console.log(report.split("\n").filter(l => /opus|sodium|crypto|davey|ffmpeg|aes|chacha/i.test(l)).map(l => `      ${l}`).join("\n"));
    check("an Opus encoder is available (opusscript)", /opusscript: \d/.test(report));
    check("DAVE (Discord's voice E2EE) is available", /davey: \d/i.test(report), "required for voice since 2026");
}

// Service: create — stubbed repository, token inspector and bot starter.
{
    const G = "123456789012345678";
    const CH = "234567890123456789";
    const ADMIN = "345678901234567890";
    const MAIN = "456789012345678901";
    const MUSIC_BOT = "567890123456789012";
    const TOKEN_KEY = randomBytes(32).toString("hex");
    const TOKEN = `${"A".repeat(24)}.${"B".repeat(6)}.${"C".repeat(27)}`;

    const previousKey = process.env.MUSIC_TOKEN_KEY;
    process.env.MUSIC_TOKEN_KEY = TOKEN_KEY;
    const rows: Array<Record<string, unknown>> = [];
    const repo = MusicBotRepository as unknown as Record<string, unknown>;
    repo.countByGuild = async () => rows.length;
    repo.create = async (entry: Record<string, unknown>) => {
        if (rows.some(r => r.botId === entry.botId)) return null;
        rows.push(entry);
        return entry;
    };
    repo.delete = async (_g: string, botId: string) => {
        const i = rows.findIndex(r => r.botId === botId);
        return i >= 0 ? rows.splice(i, 1)[0] : null;
    };

    const input: CreateMusicBotInput = { guildId: G, token: TOKEN, name: " Tunes ", voiceChannelId: CH, createdBy: ADMIN, mainBotId: MAIN };
    const account = { botId: MUSIC_BOT, applicationId: MUSIC_BOT, username: "tunes" };
    const deps = (over: Partial<Parameters<typeof createMusicBot>[1]> = {}) => ({
        inspect: async () => account,
        start: async () => ({ ok: true as const }),
        ...over,
    });

    const bad = await createMusicBot({ ...input, token: "not-a-token" }, deps());
    check("create: a malformed token is refused before calling Discord", !bad.ok && bad.problem.includes("doesn't look like"));

    const rejected = await createMusicBot(input, deps({ inspect: async () => null }));
    check("create: a token Discord rejects is refused", !rejected.ok && rejected.problem.includes("didn't accept"));

    const own = await createMusicBot(input, deps({ inspect: async () => ({ ...account, botId: MAIN }) }));
    check("create: the main bot's own token is refused", !own.ok && own.problem.includes("my own token"));

    const failed = await createMusicBot(input, deps({ start: async () => ({ ok: false as const, problem: "token reset" }) }));
    check("create: a bot that can't log in is not kept", !failed.ok && failed.problem.includes("wasn't added") && rows.length === 0);

    const okResult = await createMusicBot(input, deps());
    check("create: success returns the bot (status from the runtime)", okResult.ok && okResult.bot.botId === MUSIC_BOT && okResult.bot.name === "Tunes");
    const stored = rows[0]?.encryptedToken as string | undefined;
    check("create: the token is stored encrypted, and decrypts back", !!stored && !stored.includes(TOKEN) && decryptToken(stored, Buffer.from(TOKEN_KEY, "hex")) === TOKEN);

    const dup = await createMusicBot(input, deps());
    check("create: the same bot twice is refused", !dup.ok && dup.problem.includes("already a music bot"));

    delete process.env.MUSIC_TOKEN_KEY;
    const noKey = await createMusicBot(input, deps());
    check("create: without MUSIC_TOKEN_KEY nothing is created", !noKey.ok && noKey.problem.includes("MUSIC_TOKEN_KEY"));
    if (previousKey !== undefined) process.env.MUSIC_TOKEN_KEY = previousKey;
}

// Which bot answers in a voice channel (router).
{
    type Fake = Parameters<typeof pickBot>[0][number];
    const bot = (botId: string, mode: "fixed" | "roaming", assigned: string | null, connected: string | null, busy = false) =>
        ({ online: true, inGuild: true, busy, assignedChannelId: mode === "fixed" ? assigned : null, connectedChannelId: connected, settings: { botId, mode, voiceChannelId: assigned, name: botId, guildId: "g" } }) as unknown as Fake;
    const fixedA = bot("1", "fixed", "vcA", "vcA");
    const roamFree = bot("3", "roaming", null, null);
    const roamFree2 = bot("2", "roaming", null, null);
    const roamBusy = bot("4", "roaming", null, "vcB", true);
    const all = [fixedA, roamFree, roamFree2, roamBusy];

    const pick = (vc: string | null, starting = true, bots = all) => pickBot(bots, vc, { starting });
    const id = (p: ReturnType<typeof pickBot>) => (p.ok ? p.bot.settings.botId : p.reason);
    check("router: not in voice → told to join one", id(pick(null)) === "no-voice");
    check("router: a channel's fixed bot answers there", id(pick("vcA")) === "1");
    check("router: a roaming bot already in the channel answers there", id(pick("vcB")) === "4");
    check("router: a channel without a bot gets a free roaming bot, the same one each time (lowest id)", id(pick("vcC")) === "2" && id(pick("vcC")) === "2");
    check("router: a roaming bot never takes a channel that has a fixed bot, even with free roaming bots around", id(pick("vcA", true, [roamFree, roamFree2, fixedA])) === "1");
    check("router: with only busy roaming bots, they're busy", id(pick("vcC", true, [fixedA, roamBusy])) === "busy");
    check("router: no roaming bots at all → this channel has none", id(pick("vcC", true, [fixedA])) === "none");
    check("router: stop/skip in a channel with nothing playing → nothing here (no bot joins)", id(pick("vcC", false)) === "nothing-here");
    check("router: offline bots are skipped", id(pick("vcA", true, [{ ...fixedA, online: false } as Fake])) === "none");
    check("router: the hint lists the music channels", pickProblem("no-voice", all).includes("<#vcA>") && pickProblem("no-voice", all).includes("<#vcB>"));
}

// Text command words (per server).
{
    const words = resolveMusicSettings({ words: { play: ["ش", "play", "p"], volume: [] } }).words;
    check("words: play with a song", JSON.stringify(parseMusicCommand("ش عزرائيل", words)) === JSON.stringify({ command: "play", rest: "عزرائيل" }));
    check("words: case doesn't matter", parseMusicCommand("PLAY Never", words)?.command === "play");
    check("words: a longer word wins over a shorter one it starts with", parseMusicCommand("pause", words)?.command === "pause");
    check("words: a word inside another word is not a command", parseMusicCommand("playful day", words) === null && parseMusicCommand("ششش", words) === null);
    check("words: an emptied list keeps the defaults", words.volume.includes("volume") && parseMusicCommand("صوت 70", words)?.rest === "70");
    const odd = resolveMusicSettings({ words: { stop: ["  STOP ", "two words", "x".repeat(30), "stop"] } }).words.stop;
    check("words: trimmed, lower-cased, no spaces or overlong words, no repeats", JSON.stringify(odd) === JSON.stringify(["stop"]), JSON.stringify(odd));
    const d = resolveMusicSettings(null);
    check("settings: defaults are commands on, panel on, bots stay in their channel", d.commands && d.panel && d.stay);
    check("settings: a server's own choices are kept", JSON.stringify(resolveMusicSettings({ commands: false, panel: true, stay: false })) .includes('"commands":false'));
}

// A roaming bot is invited with voice permissions; a fixed one with none.
{
    const roam = new URL(musicBotInviteUrl("222", "999", "roaming")).searchParams.get("permissions")!;
    const bits = BigInt(roam);
    check("roaming invite: can join and speak anywhere", (bits & PermissionFlagsBits.Connect) !== 0n && (bits & PermissionFlagsBits.Speak) !== 0n);
    check("roaming invite: nothing that manages", (bits & (PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageChannels | PermissionFlagsBits.MoveMembers | PermissionFlagsBits.ManageRoles)) === 0n);
    check("fixed invite: still no permissions", new URL(musicBotInviteUrl("222", "999", "fixed")).searchParams.get("permissions") === "0");
}

// Links.
{
    check("links: YouTube ids are read from every link shape", ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=3", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=x"].every(u => youtubeIdOf(u) === "dQw4w9WgXcQ"));
    check("links: a song name is not a link", youtubeIdOf("never gonna give you up") === null);
}

// Message Content intent off in the Developer Portal: recognised, so the bot logs in again without it.
{
    check("intents: close code 4014 is recognised", isDisallowedIntents({ code: 4014 }));
    check("intents: discord.js's message is recognised", isDisallowedIntents(new Error("Used disallowed intents")));
    check("intents: a bad token is not mistaken for it", !isDisallowedIntents(new Error("An invalid token was provided.")));
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll music checks passed.");
