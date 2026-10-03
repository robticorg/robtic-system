import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Music bot tokens at rest: AES-256-GCM with a key from `MUSIC_TOKEN_KEY` (32 bytes, as 64 hex
 * characters or base64 — `openssl rand -hex 32`). The key lives only in the environment, so a
 * database dump alone reveals no token. GCM also authenticates: a tampered value fails to decrypt
 * instead of producing a wrong token.
 *
 * Stored as `v1:<iv>:<tag>:<ciphertext>`, all base64.
 */

const VERSION = "v1";

/** The key, or `null` when `MUSIC_TOKEN_KEY` is missing or not 32 bytes — music bots then refuse to start. */
export function musicTokenKey(raw = process.env.MUSIC_TOKEN_KEY): Buffer | null {
    const value = raw?.trim();
    if (!value) return null;
    const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
    return key.length === 32 ? key : null;
}

export function encryptToken(token: string, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** The token, or `null` if the value is malformed, was tampered with, or was encrypted with another key. */
export function decryptToken(stored: string, key: Buffer): string | null {
    const [version, iv, tag, data] = stored.split(":");
    if (version !== VERSION || !iv || !tag || !data) return null;
    try {
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
        decipher.setAuthTag(Buffer.from(tag, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
    } catch {
        return null;
    }
}
