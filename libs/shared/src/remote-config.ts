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
const BOT = process.env.ROBTIC_BOT?.trim();
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
  if (v !== "v1" || !iv || !tag || !data) throw new Error("unknown format");
  const d = createDecipheriv("aes-256-gcm", key, new Uint8Array(Buffer.from(iv, "base64")));
  d.setAuthTag(new Uint8Array(Buffer.from(tag, "base64")));
  return Buffer.concat([d.update(new Uint8Array(Buffer.from(data, "base64"))), d.final()] as unknown as Uint8Array[]).toString("utf8");
}

if (URI && KEY && BOT) {
  const key = new Uint8Array(Buffer.from(KEY, "base64"));
  if (key.length !== 32) throw new Error("[remote-config] ROBTIC_CONFIG_KEY must be 32 bytes, base64.");

  const conn = await mongoose.createConnection(URI, { serverSelectionTimeoutMS: 20_000 }).asPromise();
  const read = () => conn.collection<ConfigDoc>(COLLECTION).findOne({ _id: BOT } as never) as Promise<ConfigDoc | null>;
  const doc = await read();
  if (!doc) throw new Error(`[remote-config] no settings for "${BOT}" in ${COLLECTION}. Set them in the admin console first.`);

  let count = 0;
  for (const [name, value] of Object.entries(doc.env ?? {})) {
    try {
      process.env[name] = decrypt(value, key);
      count++;
    } catch {
      // Never print the value. A wrong key fails every variable, so stop rather than run half-configured.
      throw new Error(`[remote-config] could not decrypt ${name}: is ROBTIC_CONFIG_KEY right?`);
    }
  }
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
