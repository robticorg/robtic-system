import { writeFile } from "node:fs/promises";
import { ClientManager } from "@core/client-manager";
import { onShutdown } from "@internal-api";
import { Logger } from "@logger";
import { setEventGuard } from "@core/event-guard";
import { SUPER_ADMIN_ID } from "@constants";
import {
    acquireLeadership,
    claimEvent,
    clearGatewayConflict,
    currentLeader,
    isRedisConfigured,
    readGatewayConflict,
    reportGatewayConflict,
    setJobOrigin,
    type GatewayRole,
    type Leadership,
} from "@queue";
import { stopAllMusicBots } from "@bot/features/music/engine/music-manager";
import { client as bankClient } from "../bank";

const CTX = "gateway";

/** Touched while this container is doing its job (leading and connected, or standing by). Docker's healthcheck reads its age. */
export const HEALTH_FILE = "/tmp/gateway-health";
/** A leader that can't stay connected to Discord this long restarts, so Docker brings up a fresh one. */
const DISCONNECTED_LIMIT_MS = 3 * 60_000;

let health: NodeJS.Timeout | null = null;
let lastAlert = 0;

/** DMs the bot owner — at most every 10 minutes, so a flapping conflict can't spam. */
async function alertOwner(text: string): Promise<void> {
    if (!SUPER_ADMIN_ID || Date.now() - lastAlert < 10 * 60_000) return;
    lastAlert = Date.now();
    const client = ClientManager.getInstance().getClient();
    const owner = await client?.users.fetch(SUPER_ADMIN_ID).catch(() => null);
    await owner?.send(text).catch(err => Logger.warn(`Could not DM the owner about a split brain: ${err}`, CTX));
}

function beat(): void {
    void writeFile(HEALTH_FILE, String(Date.now())).catch(() => {});
}

function startHeartbeat(isHealthy: () => boolean): void {
    if (health) clearInterval(health);
    const tick = () => { if (isHealthy()) beat(); };
    tick();
    health = setInterval(tick, 15_000);
}

/** Logs every Discord session of this process out, with a deadline so a stuck close can't block a handover. */
async function logOutEverywhere(): Promise<void> {
    await Promise.race([
        Promise.allSettled([ClientManager.getInstance().stop(), stopAllMusicBots(), Promise.resolve(bankClient.destroy())]),
        new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
}

/**
 * Blocks until this container may log in to Discord (see `@queue` leader). Without Redis there is
 * nothing to coordinate with and it returns at once — a single Gateway, as before.
 *
 * Losing the lock (another Gateway took over, or the primary came back to a standby) logs out and
 * exits; Docker's restart policy brings this container back as the one waiting.
 */
export async function waitForGatewayLeadership(): Promise<void> {
    if (!isRedisConfigured()) return;

    const role: GatewayRole = process.env.GATEWAY_ROLE === "standby" ? "standby" : "primary";
    startHeartbeat(() => true); // waiting is healthy

    let leadership: Leadership | null = null;
    let stepping = false;
    const stepDown = async (reason: string, exitCode: number) => {
        if (stepping) return;
        stepping = true;
        Logger.warn(`Stepping down: ${reason}`, CTX);
        await logOutEverywhere();
        await leadership?.release();
        process.exit(exitCode);
    };

    leadership = await acquireLeadership({
        role,
        log: message => Logger.info(message, CTX),
        onLost: reason => void stepDown(reason, 0),
    });

    const me = leadership.id;
    setJobOrigin(me);

    /**
     * Split brain — another Gateway is logged in too (it claimed an event we received, or the
     * workers saw both of us queue jobs). Whoever doesn't hold the lock logs out at once; the
     * lock holder keeps going and tells the owner.
     */
    const onConflict = async (other: string, how: string) => {
        if (stepping) return;
        const holder = await currentLeader().catch(() => null);
        if (holder !== me) {
            await reportGatewayConflict(me, other, how).catch(() => {});
            await stepDown(`split brain (${how}): ${other} is logged in and holds the lock`, 0);
            return;
        }
        Logger.error(`SPLIT BRAIN (${how}): ${other} was logged in alongside this Gateway — it is being logged out`, CTX);
        await clearGatewayConflict().catch(() => {});
        await alertOwner(`⚠️ **Split brain detected** (${how}): two bot containers were logged in at the same time — \`${me}\` (kept, holds the lock) and \`${other}\` (logged out). Duplicate events were skipped; check \`docker ps\`.`);
    };

    // Every event is claimed before any listener runs: the first Gateway handles it, a second skips it.
    setEventGuard(async eventId => {
        const owner = await claimEvent(eventId, me);
        if (owner === me) return true;
        void onConflict(owner, "same Discord event");
        return false;
    });

    // Leading: healthy only while the main client is connected; restart if it can't reconnect.
    const manager = ClientManager.getInstance();
    let disconnectedSince = Date.now();
    startHeartbeat(() => {
        if (manager.getStatus().online) {
            disconnectedSince = Date.now();
            return true;
        }
        if (Date.now() - disconnectedSince > DISCONNECTED_LIMIT_MS) void stepDown(`not connected to Discord for ${DISCONNECTED_LIMIT_MS / 60_000} minutes`, 1);
        return false;
    });

    // Conflicts the workers found (jobs from two Gateways interleaving).
    const conflictWatch = setInterval(() => {
        void readGatewayConflict().then(conflict => {
            if (!conflict || !conflict.gateways.includes(me)) return;
            const other = conflict.gateways.find(id => id !== me);
            if (other) void onConflict(other, `reported by ${conflict.detectedBy}`);
        }).catch(() => {});
    }, 5_000);

    // On a deploy/stop: log out first, then free the lock — the other container takes over within
    // a couple of seconds and is never logged in at the same time as this one.
    onShutdown("gateway leadership", async () => {
        stepping = true;
        clearInterval(conflictWatch);
        setEventGuard(null);
        await logOutEverywhere();
        await leadership?.release();
    });
}
