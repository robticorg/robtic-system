import { createDecipheriv } from "node:crypto";
import mongoose from "mongoose";

// Settings from the Robtic admin console. The container keeps only three values:
//   ROBTIC_CONFIG_MONGO_URI  where the settings are (the config database)
//   ROBTIC_CONFIG_KEY        the key they're encrypted with (32 bytes, base64)
//   ROBTIC_BOT               which bot this is (system | staff)
// Everything else (the token, this bot's own database, every other variable) is read here, decrypted and put into
// process.env before the rest of the bot loads, so the existing code reads it exactly as before. Without those three
// values this does nothing and the bot uses its environment as it always did.
//
// Values are AES-256-GCM `v1.<iv>.<tag>.<data>` (base64), written by robtic-discord (libs/server/src/secure-config.ts).
// This file is the same in robtic-system and robtic-staff.

const URI = process.env.ROBTIC_CONFIG_MONGO_URI?.trim();
const KEY = process.env.ROBTIC_CONFIG_KEY?.trim();
/** Which bot this file belongs to when ROBTIC_BOT isn't set (the only line that differs between the two bots). */
const DEFAULT_BOT = "system";
const BOT = process.env.ROBTIC_BOT?.trim() || DEFAULT_BOT;
const REMOTE = !!(process.env.ROBTIC_CONFIG_MONGO_URI?.trim() && process.env.ROBTIC_CONFIG_KEY?.trim());
const COLLECTION = process.env.ROBTIC_CONFIG_COLLECTION?.trim() || "discord_bot_config";
/** How often the blocked-server list is read again. */
const REFRESH_MS = 60_000;

interface ConfigDoc {
  _id: string;
  env?: Record<string, string>;
  blacklist?: { guildId: string }[];
}

let blocked = new Set<string>();
const listeners = new Set<(ids: string[]) => void>();

/** Whether the admin console blocked this server for this bot. */
export const isGuildBlocked = (guildId: string): boolean => blocked.has(guildId);

/** Called with the whole list whenever it changes (so the bot can leave newly blocked servers). */
export function onBlockedChange(fn: (ids: string[]) => void): void {
  listeners.add(fn);
}

function decrypt(value: string, key: Uint8Array): string {
  const [v, iv, tag, data] = value.split(".");
  // An empty value encrypts to an empty data part, so only a missing part is wrong.
  if (v !== "v1" || !iv || !tag || data === undefined) throw new Error("unknown format");
  const d = createDecipheriv("aes-256-gcm", key, new Uint8Array(Buffer.from(iv, "base64")));
  d.setAuthTag(new Uint8Array(Buffer.from(tag, "base64")));
  return Buffer.concat([d.update(new Uint8Array(Buffer.from(data, "base64"))), d.final()] as unknown as Uint8Array[]).toString("utf8");
}

let reloadEnv: (() => Promise<void>) | null = null;

if (URI && KEY && REMOTE) {
  const key = new Uint8Array(Buffer.from(KEY, "base64"));
  if (key.length !== 32) throw new Error("[remote-config] ROBTIC_CONFIG_KEY must be 32 bytes, base64.");

  const conn = await mongoose.createConnection(URI, { serverSelectionTimeoutMS: 20_000 }).asPromise();
  const read = () => conn.collection<ConfigDoc>(COLLECTION).findOne({ _id: BOT } as never) as Promise<ConfigDoc | null>;
  // No settings yet is fine: the bot waits for its token below instead of failing.
  const doc: ConfigDoc = (await read()) ?? { _id: BOT };

  const apply = (d: ConfigDoc): number => {
    let n = 0;
    for (const [name, value] of Object.entries(d.env ?? {})) {
      try {
        process.env[name] = decrypt(value, key);
        n++;
      } catch {
        // Never print the value. A wrong key fails every variable, so stop rather than run half-configured.
        throw new Error(`[remote-config] could not decrypt ${name}: is ROBTIC_CONFIG_KEY right?`);
      }
    }
    return n;
  };
  const count = apply(doc);
  reloadEnv = async () => { const d = await read(); if (d) apply(d); };
  blocked = new Set((doc.blacklist ?? []).map((b) => b.guildId));
  console.log(`[remote-config] ${count} settings loaded for ${BOT}, ${blocked.size} blocked server(s).`);

  const timer = setInterval(async () => {
    try {
      const next = new Set(((await read())?.blacklist ?? []).map((b) => b.guildId));
      const changed = next.size !== blocked.size || [...next].some((id) => !blocked.has(id));
      blocked = next;
      if (changed) for (const fn of listeners) fn([...next]);
    } catch (err) {
      console.warn("[remote-config] could not refresh the blocked servers", err);
    }
  }, REFRESH_MS);
  timer.unref?.();
}

/* ------------------------------------------------------------------ no token yet: wait quietly */

// A bot without its Discord token used to crash and restart over and over. Now it waits: with the config store it
// checks every 30 seconds and starts as soon as a token is saved in the admin console; without it, it says so once and
// idles until restarted. Its health check stays green meanwhile, so nothing flaps.

const TOKEN_KEY = BOT === "staff" ? "DISCORD_TOKEN" : process.env.NODE_ENV === "production" ? "MainBotToken" : "TestBot";
/** Only the processes that log in to Discord need it (not robtic-system's workers or internal APIs). */
const NEEDS_TOKEN = BOT === "staff" || /apps[\/]bot[\/]/.test(process.argv[1] ?? "");

if (NEEDS_TOKEN && !process.env[TOKEN_KEY]?.trim()) {
  console.log(`[remote-config] no Discord token yet (${TOKEN_KEY}): waiting${reloadEnv ? " for it to be set in the admin console" : ""}.`);
  const healthy = keepHealthy();
  await new Promise<void>((resolve) => {
    const timer = setInterval(async () => {
      if (!reloadEnv) return; // nothing can change until the container restarts with a token
      try {
        await reloadEnv();
      } catch {
        return; // the database is back next time
      }
      if (process.env[TOKEN_KEY]?.trim()) {
        clearInterval(timer);
        resolve();
      }
    }, 30_000);
  });
  healthy();
  console.log("[remote-config] token found, starting.");
}

/** Keeps the container's health check green while waiting; returns a function that stops doing so. */
function keepHealthy(): () => void {
  // robtic-system's Gateway health check reads this file's timestamp.
  const touch = () => { void Bun.write("/tmp/gateway-health", String(Date.now())).catch(() => {}); };
  touch();
  const timer = setInterval(touch, 20_000);
  // robtic-staff's health check calls its internal API, which only starts with the bot: answer it meanwhile.
  let server: ReturnType<typeof Bun.serve> | null = null;
  if (BOT === "staff") {
    try {
      server = Bun.serve({
        hostname: process.env.INTERNAL_API_HOST || "127.0.0.1",
        port: Number(process.env.INTERNAL_API_PORT || 8788),
        fetch: (req) => (new URL(req.url).pathname === "/internal/health" ? Response.json({ ok: true, waiting: "token" }) : new Response("Starting", { status: 503 })),
      });
    } catch {
      server = null;
    }
  }
  return () => {
    clearInterval(timer);
    server?.stop(true);
  };
}
