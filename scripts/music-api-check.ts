/**
 * Music app checks — no Discord, no MongoDB: the API handler runs without a socket, the service
 * with a stubbed repository, token inspector and bot starter.
 */
import { randomBytes } from "node:crypto";
import { createInternalHandler } from "@internal-api";
import { MusicBotRepository } from "@database/repositories";
import { createMusicBot, decryptToken, type CreateMusicBotInput, type MusicBotView } from "@core/music";
import { musicRoutes, type MusicService } from "../apps/music/src/routes";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const G = "123456789012345678";
const CH = "234567890123456789";
const ADMIN = "345678901234567890";
const MAIN = "456789012345678901";
const MUSIC_BOT = "567890123456789012";
const TOKEN_KEY = randomBytes(32).toString("hex");
const TOKEN = `${"A".repeat(24)}.${"B".repeat(6)}.${"C".repeat(27)}`;
const INTERNAL = "test-internal-token";

// ── API ───────────────────────────────────────────────────────────────────────────────────────
await (async () => {
    const created: CreateMusicBotInput[] = [];
    const view: MusicBotView = { botId: MUSIC_BOT, applicationId: MUSIC_BOT, name: "Tunes", guildId: G, voiceChannelId: CH, status: "online" };
    const service: MusicService = {
        create: async input => { created.push(input); return { ok: true, bot: view, username: "tunes" }; },
        list: async () => [view],
        ensureAll: async () => ({ restarted: 1, alreadyOnline: 2, failed: 0 }),
        remove: async (_g, botId) => (botId === MUSIC_BOT ? { name: "Tunes", voiceChannelId: CH } : null),
    };
    const handle = createInternalHandler("music", musicRoutes(service), INTERNAL);
    const call = (path: string, init: RequestInit = {}, token: string | null = INTERNAL) =>
        handle(new Request(`http://music${path}`, { ...init, headers: { ...(token ? { "x-internal-token": token } : {}), "content-type": "application/json", ...init.headers } }));
    const json = async (r: Response) => r.json() as Promise<any>;
    const body = { guildId: G, voiceChannelId: CH, createdBy: ADMIN, mainBotId: MAIN, token: TOKEN, name: "Tunes" };

    const r1 = await call("/bots", { method: "POST", body: JSON.stringify(body) });
    const j1 = await json(r1);
    check("POST /bots creates through the service", r1.status === 200 && j1.data.ok && created[0]?.token === TOKEN);
    check("…and the response never echoes the token", !JSON.stringify(j1).includes(TOKEN));

    const r2 = await call("/bots", { method: "POST", body: JSON.stringify({ ...body, voiceChannelId: "general" }) });
    check("POST /bots: a bad channel id is a 422 naming the field", r2.status === 422 && JSON.stringify(await json(r2)).includes("voiceChannelId"));
    const r3 = await call("/bots", { method: "POST", body: JSON.stringify({ ...body, name: "x".repeat(33) }) });
    check("POST /bots: a name over 32 characters is refused", r3.status === 422);

    const r4 = await call(`/guilds/${G}/bots`);
    check("GET /guilds/:id/bots lists with live status", r4.status === 200 && (await json(r4)).data[0].status === "online");

    const r5 = await call(`/guilds/${G}/bots/${MUSIC_BOT}`, { method: "DELETE" });
    check("DELETE removes and returns what the Gateway needs to clean up", (await json(r5)).data.voiceChannelId === CH);
    const r6 = await call(`/guilds/${G}/bots/${MAIN}`, { method: "DELETE" });
    check("DELETE an unknown bot → null (the command says so)", (await json(r6)).data === null);

    const rEnsure = await call("/bots/ensure", { method: "POST", body: "{}" });
    check("POST /bots/ensure restarts offline bots through the service", rEnsure.status === 200 && (await json(rEnsure)).data.restarted === 1);

    const r7 = await call(`/guilds/${G}/bots`, {}, null);
    check("no internal token → 401", r7.status === 401);
    const r8 = await call(`/guilds/${G}/bots`, {}, "wrong");
    check("wrong internal token → 401", r8.status === 401);
})();

// ── Service: create ───────────────────────────────────────────────────────────────────────────
await (async () => {
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
})();

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll music app checks passed.");
process.exit(0);
