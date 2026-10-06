import { getRedis } from "./message-buffer";

/**
 * A cooldown shared by every Gateway process: `SET key NX PX ms` succeeds for exactly one caller
 * per window, so two messages arriving together can't both pass (the old read-then-write check
 * against MongoDB could). `true` = claimed, go ahead.
 */
export async function claimCooldown(key: string, ms: number): Promise<boolean> {
    return (await getRedis().set(key, "1", "PX", ms, "NX")) === "OK";
}

/** Gives a claimed window back — for when the work it guarded never got queued. */
export async function releaseCooldown(key: string): Promise<void> {
    await getRedis().del(key);
}
