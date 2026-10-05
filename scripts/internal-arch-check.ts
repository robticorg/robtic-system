/**
 * Internal-API / queue / worker architecture checks — no Redis, no MongoDB, no Discord:
 * the API handler runs without a socket, the worker processor with in-memory stores, the client
 * against a fake fetch.
 */
import { UnrecoverableError } from "bullmq";
import { ApiError } from "@sdk";
import { createInternalHandler } from "@internal-api";
import { callInternalApi, InternalApiError, unavailableMessage } from "@internal-client";
import { GLOBAL_CONCURRENCY, DEFAULT_JOB_OPTIONS, jobIds, redisConnection, type DiscordOutboxJob, type InviteJob } from "@queue";
import { processInviteJoin, processInviteLeave, type InviteHistoryStore } from "@core/invites";
import type { InviteCreditStore } from "@core/rewards";
import { invitesRoutes, type InvitesService } from "../internal-api/invites/src/routes";
import { processInvitesJob } from "../apps/worker/src/processors/invites";
import { processOutboxJob } from "../apps/bot/src/services/discord-outbox";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const G = "123456789012345678";
const U = "234567890123456789";
const INVITER = "345678901234567890";
const TOKEN = "test-internal-token";

// ── Invites API ──────────────────────────────────────────────────────────────────────────────
await (async () => {
    const stats = { joins: 3, leaves: 1, fakes: 0, total: 2, recentJoins: 1, bonusBp: 200 };
    let dbDown = false;
    const service: InvitesService = {
        stats: async () => { if (dbDown) throw new Error("MongoNetworkError: connection reset"); return stats; },
        invited: async (_g, _u, skip, limit) => ({ total: 42, rows: [{ inviteeId: U, joinedAt: new Date(0).toISOString(), leftAt: null, fake: false }].slice(0, limit + skip) }),
    };
    const handle = createInternalHandler("invites-api", invitesRoutes(service), TOKEN);
    const call = (path: string, init: RequestInit = {}, token: string | null = TOKEN) =>
        handle(new Request(`http://invites-api${path}`, { ...init, headers: { ...(token ? { "x-internal-token": token } : {}), "x-request-id": "req-1", ...init.headers } }));
    const json = async (r: Response) => r.json() as Promise<any>;

    const okRes = await call(`/invites/${G}/members/${U}/stats`);
    const okBody = await json(okRes);
    check("API: valid request → 200 with the stats", okRes.status === 200 && okBody.ok && okBody.data.total === 2);
    check("API: request id echoed back", okRes.headers.get("x-request-id") === "req-1");

    const bad = await call(`/invites/not-an-id/members/${U}/stats`);
    check("API: invalid id → 422 (the @sdk validation status) naming the field", bad.status === 422 && (await json(bad)).error.details?.guildId !== undefined);
    const badLimit = await call(`/invites/${G}/members/${U}/invited?limit=5000`);
    check("API: out-of-range query → 422", badLimit.status === 422);

    check("API: no token → 401", (await call(`/invites/${G}/members/${U}/stats`, {}, null)).status === 401);
    check("API: wrong token → 401", (await call(`/invites/${G}/members/${U}/stats`, {}, "nope")).status === 401);
    check("API: unknown route → 404", (await call(`/invites/${G}/nothing`)).status === 404);
    check("API: wrong method → 405", (await call(`/invites/${G}/members/${U}/stats`, { method: "POST", body: "{}" })).status === 405);

    const health = await call("/health", {}, null);
    check("API: /health needs no token", health.status === 200 && (await json(health)).status === "ok");

    dbDown = true;
    const down = await call(`/invites/${G}/members/${U}/stats`);
    const downBody = await json(down);
    check("API: database failure → 500 envelope", down.status === 500 && downBody.ok === false);
    check("API: no internals leak to the caller", !JSON.stringify(downBody).includes("MongoNetworkError"));
})();

// ── Gateway → API client ─────────────────────────────────────────────────────────────────────
await (async () => {
    const realFetch = globalThis.fetch;
    process.env.TEST_API_URL = "http://invites-api:3005";
    process.env.INTERNAL_API_TOKEN = TOKEN;
    const respond = (fn: (url: string, init: RequestInit) => Promise<Response>) => { globalThis.fetch = fn as unknown as typeof fetch; };
    const kind = async (p: Promise<unknown>) => p.then(() => "ok", e => (e instanceof InternalApiError ? e.kind : `other:${e}`));

    let seen: RequestInit | null = null;
    respond(async (_u, init) => { seen = init; return Response.json({ ok: true, data: { x: 1 } }); });
    const data = await callInternalApi<{ x: number }>("t", "TEST_API_URL", "/x", { requestId: "abc" });
    const headers = (seen as RequestInit | null)?.headers as Record<string, string> | undefined;
    check("client: success unwraps data", data.x === 1);
    check("client: sends the internal token and request id", headers?.["x-internal-token"] === TOKEN && headers?.["x-request-id"] === "abc");

    respond(async () => { const e = new Error("timeout"); e.name = "TimeoutError"; throw e; });
    check("client: timeout → timeout", await kind(callInternalApi("t", "TEST_API_URL", "/x")) === "timeout");
    respond(async () => { throw new TypeError("connection refused"); });
    check("client: connection refused → unavailable", await kind(callInternalApi("t", "TEST_API_URL", "/x")) === "unavailable");
    respond(async () => Response.json({ ok: false, error: { code: "NOT_FOUND", message: "x" } }, { status: 404 }));
    check("client: 4xx → rejected", await kind(callInternalApi("t", "TEST_API_URL", "/x")) === "rejected");
    respond(async () => Response.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "x" } }, { status: 500 }));
    check("client: 5xx → failed", await kind(callInternalApi("t", "TEST_API_URL", "/x")) === "failed");
    respond(async () => new Response("<html>bad gateway</html>", { status: 502 }));
    check("client: malformed response → malformed", await kind(callInternalApi("t", "TEST_API_URL", "/x")) === "malformed");
    check("client: missing base URL → unavailable", await kind(callInternalApi("t", "NOT_SET_URL", "/x")) === "unavailable");
    check("client: user-facing text hides the internals", unavailableMessage("invites") === "The invites service is temporarily unavailable. Please try again in a moment.");

    globalThis.fetch = realFetch;
})();

// ── Queue foundation ─────────────────────────────────────────────────────────────────────────
{
    const c = redisConnection("redis://user:p%40ss@robtic-redis:6380/2") as Record<string, unknown>;
    check("queue: REDIS_URL parsed for BullMQ", c.host === "robtic-redis" && c.port === 6380 && c.password === "p@ss" && c.db === 2 && c.maxRetriesPerRequest === null);
    let threw = false;
    try { redisConnection(""); } catch { threw = true; }
    check("queue: no REDIS_URL is a clear error, never a hardcoded host", threw);
    const at = new Date("2026-10-05T12:00:00Z");
    check("queue: job ids are deterministic", jobIds.inviteJoin(G, U, at) === jobIds.inviteJoin(G, U, new Date(at)));
    check("queue: job ids never contain ':' (BullMQ rule)", !jobIds.inviteJoin(G, U, at).includes(":") && !jobIds.inviteLeaveAnnouncement(G, U, at.toISOString()).includes(":"));
    check("queue: invites run one at a time across all workers", GLOBAL_CONCURRENCY.invites === 1);
    check("queue: retries with exponential backoff, bounded", DEFAULT_JOB_OPTIONS.attempts === 6 && (DEFAULT_JOB_OPTIONS.backoff as { type: string }).type === "exponential");
}

// ── Worker: invites jobs (in-memory MongoDB stand-ins) ───────────────────────────────────────
function memoryStores() {
    const joins: Array<{ guildId: string; inviteeId: string; inviterId: string | null; source: "invite" | "vanity" | "unknown"; joinedAt: Date; leftAt: Date | null; fake: boolean }> = [];
    const credits: Array<{ guildId: string; inviteeId: string; inviterId: string; leftAt: Date | null; expiresAt: Date }> = [];
    let failNextRecord = false;
    const history: InviteHistoryStore = {
        hasRealJoinSince: async (g, i, since) => joins.some(j => j.guildId === g && j.inviteeId === i && !j.fake && j.joinedAt >= since),
        record: async entry => {
            if (failNextRecord) { failNextRecord = false; throw new Error("MongoNetworkError: transient"); }
            if (joins.some(j => j.guildId === entry.guildId && j.inviteeId === entry.inviteeId && j.joinedAt.getTime() === entry.joinedAt.getTime())) return false;
            joins.push({ ...entry, leftAt: null });
            return true;
        },
        closeLatest: async (g, i, at) => {
            const open = joins.filter(j => j.guildId === g && j.inviteeId === i && j.leftAt === null).sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())[0];
            const row = open ?? joins.find(j => j.guildId === g && j.inviteeId === i && j.leftAt?.getTime() === at.getTime());
            if (open) open.leftAt = at;
            return row ? { inviterId: row.inviterId, source: row.source } : null;
        },
    };
    const creditStore: InviteCreditStore = {
        credit: async (g, inviter, invitee, _code, _j, expiresAt) => {
            if (credits.some(c => c.guildId === g && c.inviteeId === invitee)) return false;
            credits.push({ guildId: g, inviteeId: invitee, inviterId: inviter, leftAt: null, expiresAt });
            return true;
        },
        countActive: async (g, inviter, now) => credits.filter(c => c.guildId === g && c.inviterId === inviter && !c.leftAt && c.expiresAt > now).length,
        markLeft: async (g, invitee, at) => { for (const c of credits) if (c.guildId === g && c.inviteeId === invitee && !c.leftAt) c.leftAt = at; },
        markRejoined: async (g, invitee) => { const c = credits.find(x => x.guildId === g && x.inviteeId === invitee); if (!c) return false; c.leftAt = null; return true; },
    };
    return { joins, credits, history, creditStore, failNext: () => { failNextRecord = true; } };
}

await (async () => {
    const mem = memoryStores();
    const outbox = new Map<string, DiscordOutboxJob>();
    const deps = {
        join: (input: Parameters<typeof processInviteJoin>[0]) => processInviteJoin(input, { history: mem.history, credits: mem.creditStore }),
        leave: (input: Parameters<typeof processInviteLeave>[0]) => processInviteLeave(input, { history: mem.history, credits: mem.creditStore }),
        // BullMQ dedupes by job id — the map does the same.
        announce: async (job: DiscordOutboxJob, jobId: string) => { if (!outbox.has(jobId)) outbox.set(jobId, job); },
    };
    const joinedAt = "2026-10-05T12:00:00.000Z";
    const joinJob: InviteJob = { kind: "join", guildId: G, memberId: U, joinedAt, used: { code: "abc", inviterId: INVITER, uses: 4, maxUses: 0 }, requestId: "r1" };

    const first = await deps.join && await processInvitesJob(joinJob, deps);
    check("worker: join succeeds — history written, credit given", mem.joins.length === 1 && mem.credits.length === 1 && (first as { recorded: boolean }).recorded);
    check("worker: join queues exactly one announcement for the Gateway", outbox.size === 1 && [...outbox.values()][0]!.kind === "invite-join-announcement");

    await processInvitesJob(joinJob, deps);
    check("worker: the same join again is idempotent — no second row, credit or announcement", mem.joins.length === 1 && mem.credits.length === 1 && outbox.size === 1);

    // A transient failure mid-job: BullMQ retries it; the retry must not double anything.
    const mem2 = memoryStores();
    const deps2 = { ...deps, join: (input: Parameters<typeof processInviteJoin>[0]) => processInviteJoin(input, { history: mem2.history, credits: mem2.creditStore }) };
    mem2.failNext();
    let retried = false;
    try { await processInvitesJob(joinJob, deps2); } catch { retried = true; }
    check("worker: a transient DB error throws, so BullMQ retries", retried && !(retried && false));
    await processInvitesJob(joinJob, deps2);
    check("worker: the retry completes without duplicating the credit", mem2.credits.length === 1 && mem2.joins.length === 1);

    let permanent: unknown = null;
    try { await processInvitesJob({ ...joinJob, memberId: "not-an-id" }, deps); } catch (e) { permanent = e; }
    check("worker: invalid job data fails permanently (no retry)", permanent instanceof UnrecoverableError);

    const leaveAt = "2026-10-06T12:00:00.000Z";
    const leaveJob: InviteJob = { kind: "leave", guildId: G, memberId: U, memberName: "raouf", leftAt: leaveAt, requestId: "r2" };
    await processInvitesJob(leaveJob, deps);
    const leaveAnnouncement = [...outbox.values()].find(j => j.kind === "invite-leave-announcement");
    check("worker: leave closes the join and announces who invited them",
        mem.joins[0]!.leftAt?.toISOString() === leaveAt && leaveAnnouncement?.kind === "invite-leave-announcement" && leaveAnnouncement.inviterId === INVITER);

    outbox.clear();
    await processInvitesJob(leaveJob, deps);
    const replay = [...outbox.values()][0];
    check("worker: a retried leave still knows the inviter (finds the join it already closed)", replay?.kind === "invite-leave-announcement" && replay.inviterId === INVITER);

    const rejoin: InviteJob = { ...joinJob, joinedAt: "2026-10-07T12:00:00.000Z", requestId: "r3" };
    await processInvitesJob(rejoin, deps);
    check("worker: rejoin inside the window is recorded as fake, not credited again", mem.joins[1]?.fake === true && mem.credits.length === 1);
})();

// ── Gateway: outbox job → Discord post ───────────────────────────────────────────────────────
await (async () => {
    const posted: string[] = [];
    const fakeGuild = { id: G } as never;
    const deps = {
        guild: (id: string) => (id === G ? fakeGuild : undefined),
        announceJoin: async (_g: unknown, memberId: string) => { posted.push(`join:${memberId}`); },
        announceLeave: async (_g: unknown, name: string, joined: { inviterId: string | null } | null) => { posted.push(`leave:${name}:${joined?.inviterId}`); },
    };
    const r1 = await processOutboxJob({ kind: "invite-join-announcement", guildId: G, memberId: U, used: null, requestId: "x" }, deps as never);
    const r2 = await processOutboxJob({ kind: "invite-leave-announcement", guildId: G, memberId: U, memberName: "raouf", source: "invite", inviterId: INVITER, requestId: "x" }, deps as never);
    check("gateway: outbox join → announce", r1 === "sent" && posted[0] === `join:${U}`);
    check("gateway: outbox leave → announce with the inviter", r2 === "sent" && posted[1] === `leave:raouf:${INVITER}`);
    const r3 = await processOutboxJob({ kind: "invite-join-announcement", guildId: "999999999999999999", memberId: U, used: null, requestId: "x" }, deps as never);
    check("gateway: a guild the bot left is skipped, not retried", r3 === "skipped" && posted.length === 2);

    const failing = { ...deps, announceJoin: async () => { throw ApiError.upstream("Discord 503"); } };
    let threw = false;
    try { await processOutboxJob({ kind: "invite-join-announcement", guildId: G, memberId: U, used: null, requestId: "x" }, failing as never); } catch { threw = true; }
    check("gateway: a failed Discord post throws, so the outbox retries it", threw);
})();

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll internal architecture checks passed.");
