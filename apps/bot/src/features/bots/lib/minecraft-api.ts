
import { L } from "@utils";/**
 * The main bot's only line to the Minecraft project: its API's `/api/bot` endpoint, which owns the
 * Minecraft Discord bot — the token is checked, encrypted and run over there, never here.
 *
 * Needs `MINECRAFT_API_URL` (e.g. `http://host.docker.internal:3002`) and `MINECRAFT_BOT_SECRET`
 * (the same value as in the Minecraft API's .env).
 */

export interface MinecraftBotView {
    configured: boolean;
    online: boolean;
    botId?: string;
    applicationId?: string;
    username?: string;
    inviteUrl?: string;
}

export type MinecraftApiResult<T> = { ok: true; data: T } | { ok: false; problem: string };

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

async function call<T>(method: "GET" | "POST" | "DELETE", body: unknown, timeoutMs: number): Promise<MinecraftApiResult<T>> {
    const base = process.env.MINECRAFT_API_URL?.trim().replace(/\/+$/, "");
    const secret = process.env.MINECRAFT_BOT_SECRET?.trim();
    if (!base || !secret) {
        return { ok: false, problem: L("The Minecraft bot isn't set up yet: `MINECRAFT_API_URL` or `MINECRAFT_BOT_SECRET` is missing from the bot's environment.", "بوت ماينكرافت غير مجهز: `MINECRAFT_API_URL` أو `MINECRAFT_BOT_SECRET` ناقص في إعدادات البوت.") };
    }

    try {
        const response = await fetch(`${base}/api/bot`, {
            method,
            headers: { authorization: `Bearer ${secret}`, ...(body ? { "content-type": "application/json" } : {}) },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
        });
        const envelope = await response.json().catch(() => null) as Envelope<T> | null;
        if (!envelope) return { ok: false, problem: L(`The Minecraft API answered ${response.status} with no usable body.`, `Minecraft API رد بـ ${response.status} بدون بيانات.`) };
        if (!envelope.ok) return { ok: false, problem: L(`The Minecraft API refused: ${envelope.error.message}`, `Minecraft API رفض: ${envelope.error.message}`) };
        return { ok: true, data: envelope.data };
    } catch (error) {
        const timedOut = error instanceof DOMException && error.name === "TimeoutError";
        return { ok: false, problem: timedOut ? L("The Minecraft API didn't answer in time. Is it running?", "Minecraft API ما رد بالوقت. هو شغال؟") : L("I couldn't reach the Minecraft API. Is it running?", "ما قدرت أوصل لـ Minecraft API. هو شغال؟") };
    }
}

export function getMinecraftBot(timeoutMs = 1500): Promise<MinecraftApiResult<MinecraftBotView>> {
    return call<MinecraftBotView>("GET", null, timeoutMs);
}

/** Logging a bot in takes a few seconds, so this waits longer than a lookup. */
export function enableMinecraftBot(input: { token: string; guildId: string; createdBy: string; mainBotId: string }) {
    return call<{ ok: true; bot: MinecraftBotView } | { ok: false; problem: string }>("POST", input, 30_000);
}

export function deleteMinecraftBot() {
    return call<{ removed: { username: string; botId: string } | null }>("DELETE", null, 15_000);
}
