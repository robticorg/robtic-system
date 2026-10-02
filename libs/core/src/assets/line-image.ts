import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { BranchAssetRepository } from "@database/repositories";

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

/** The current line image, or `null` if none is set and `images/line.png` is missing. */
export function getLineImage(): Promise<LineImage | null> {
    cached ??= load().catch(err => {
        cached = null;
        throw err;
    });
    return cached;
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
