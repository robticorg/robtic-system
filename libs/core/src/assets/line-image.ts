import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { BranchAssetRepository } from "@database/repositories";
import { isBrandedGuild } from "./branding";

/**
 * The separator line image the bot posts (line channels, the activity panel, boost thank-yous).
 *
 * The one set with `/setline` wins; without one, the repository's `images/line.png` is used. Read
 * once and kept in memory — `setLineImage` / `resetLineImage` refresh it, so every sender picks up
 * a new line immediately without a restart.
 */

export interface LineImage {
    data: Buffer;
    /** Send it under this name and reference it as `attachment://<name>`. */
    name: string;
}

const KEY = "line";
const FALLBACK_PATH = path.join(process.cwd(), "images", "line.png");

let cached: Promise<LineImage | null> | null = null;

async function load(): Promise<LineImage | null> {
    const stored = await BranchAssetRepository.get(KEY);
    if (stored) return { data: Buffer.from(stored.data), name: stored.fileName };
    if (existsSync(FALLBACK_PATH)) return { data: await readFile(FALLBACK_PATH), name: "line.png" };
    return null;
}

/** The bot-wide line (/setline, else images/line.png): only Robtic's own servers use it. */
function getSharedLine(): Promise<LineImage | null> {
    cached ??= load().catch(err => {
        cached = null;
        throw err;
    });
    return cached;
}

const perGuild = new Map<string, Promise<LineImage | null>>();
const guildKey = (guildId: string) => `line:${guildId}`;

/**
 * A server's line: the one it uploaded on the dashboard. Robtic's own servers (ROBTIC_BRANDED_GUILD_IDS) fall back to
 * the bot-wide line; any other server without its own has no line, so nothing is posted.
 */
export function getLineImage(guildId?: string | null): Promise<LineImage | null> {
    if (!guildId) return getSharedLine();
    let entry = perGuild.get(guildId);
    if (!entry) {
        entry = BranchAssetRepository.get(guildKey(guildId))
            .then(stored => (stored ? { data: Buffer.from(stored.data), name: stored.fileName } : null))
            .catch(err => { perGuild.delete(guildId); throw err; });
        perGuild.set(guildId, entry);
    }
    return entry.then(own => own ?? (isBrandedGuild(guildId) ? getSharedLine() : null));
}

/** Sets a server's own line (the dashboard writes it the same way). */
export async function setGuildLineImage(guildId: string, data: Buffer, contentType: string, fileName: string, updatedBy: string): Promise<void> {
    await BranchAssetRepository.set(guildKey(guildId), { data, contentType, fileName, updatedBy });
    perGuild.set(guildId, Promise.resolve({ data, name: fileName }));
}

export async function resetGuildLineImage(guildId: string): Promise<boolean> {
    const removed = await BranchAssetRepository.delete(guildKey(guildId));
    perGuild.delete(guildId);
    return removed;
}

/** Forget a server's cached line, e.g. after the dashboard changed it. */
export function forgetGuildLine(guildId: string): void {
    perGuild.delete(guildId);
}

/** File extension for the image types `/setline` accepts. */
export function lineFileName(contentType: string): string | null {
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[contentType.split(";")[0]!.trim().toLowerCase()];
    return ext ? `line.${ext}` : null;
}

export async function setLineImage(data: Buffer, contentType: string, fileName: string, updatedBy: string): Promise<void> {
    await BranchAssetRepository.set(KEY, { data, contentType, fileName, updatedBy });
    cached = Promise.resolve({ data, name: fileName });
}

/** Back to `images/line.png`. Returns whether a custom line was set. */
export async function resetLineImage(): Promise<boolean> {
    const removed = await BranchAssetRepository.delete(KEY);
    cached = null;
    return removed;
}
