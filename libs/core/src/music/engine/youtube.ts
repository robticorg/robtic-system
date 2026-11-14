import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { StreamType } from "@discordjs/voice";
import ytSearch from "yt-search";
import { Logger } from "@logger";

import { L } from "@utils";
/**
 * YouTube: search with yt-search, stream with the official yt-dlp binary. Shared by every music
 * bot — one binary, downloaded once.
 *
 * yt-dlp comes from `YTDLP_PATH`, else `yt-dlp` on PATH (the Docker image installs it), else it is
 * downloaded into `bin/` on first use, as the original bot did.
 */

const CTX = "music";
const BIN_DIR = join(process.cwd(), "bin");
const DOWNLOADED = join(BIN_DIR, "yt-dlp");

export interface Track {
    id: string;
    url: string;
    title: string;
    durationSeconds: number;
    thumbnail: string;
    author: string;
    requestedBy?: string;
    requestChannelId?: string;
}

export interface AudioSource {
    stream: Readable;
    proc: ChildProcess;
    ffmpeg?: ChildProcess;
    inputType: StreamType;
}

let ytdlpPath: Promise<string> | null = null;

function check(binary: string): Promise<string | null> {
    return new Promise(resolve => {
        const p = spawn(binary, ["--version"]);
        let out = "";
        p.stdout.on("data", d => { out += d; });
        p.on("error", () => resolve(null));
        p.on("close", code => resolve(code === 0 ? out.trim() : null));
    });
}

async function download(): Promise<string> {
    await mkdir(BIN_DIR, { recursive: true });
    Logger.info("Downloading the official yt-dlp Linux binary…", CTX);
    const res = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux", { redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`yt-dlp download failed: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(DOWNLOADED));
    chmodSync(DOWNLOADED, 0o755);
    return DOWNLOADED;
}

/** Finds (or downloads) yt-dlp once and checks it runs. */
export function ensureYtDlp(): Promise<string> {
    ytdlpPath ??= (async () => {
        for (const candidate of [process.env.YTDLP_PATH, "yt-dlp", existsSync(DOWNLOADED) ? DOWNLOADED : null]) {
            if (!candidate) continue;
            const version = await check(candidate);
            if (version) {
                Logger.info(`yt-dlp ${version} (${candidate})`, CTX);
                return candidate;
            }
        }
        const path = await download();
        if (!(await check(path))) throw new Error("yt-dlp version check failed");
        return path;
    })().catch(err => {
        ytdlpPath = null;
        throw err;
    });
    return ytdlpPath;
}

function ytArgs(url: string, format: string): string[] {
    return [
        url, "-f", format, "--no-playlist", "-o", "-", "--quiet", "--no-warnings", "--no-call-home",
        "--retries", "3", "--fragment-retries", "3", "--extractor-retries", "3",
        // The bot runs on Bun; yt-dlp uses it to solve YouTube's JS challenges.
        "--js-runtimes", process.env.YTDLP_JS_RUNTIME || "bun", "--remote-components", "ejs:github",
    ];
}

async function spawnReadable(args: string[]): Promise<{ stream: Readable; proc: ChildProcess }> {
    const ytdlp = await ensureYtDlp();
    const p = spawn(ytdlp, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr!.on("data", d => {
        err += d.toString();
        if (err.length > 8000) err = err.slice(-8000);
    });

    await new Promise<void>((resolve, reject) => {
        let settled = false;
        p.stdout!.once("readable", () => { if (!settled) { settled = true; resolve(); } });
        p.once("error", e => { if (!settled) { settled = true; reject(e); } });
        p.once("close", c => { if (!settled) { settled = true; reject(new Error(err.trim() || `yt-dlp exited ${c}`)); } });
    });

    return { stream: p.stdout!, proc: p };
}

/** The track's audio: native Opus when YouTube has it (no transcoding), otherwise PCM through ffmpeg. */
export async function getAudio(track: Track): Promise<AudioSource> {
    try {
        return {
            ...(await spawnReadable(ytArgs(track.url, "bestaudio[ext=webm][acodec=opus]/bestaudio[acodec=opus]"))),
            inputType: StreamType.WebmOpus,
        };
    } catch (e) {
        Logger.warn(`Native Opus stream failed: ${(e as Error).message}`, CTX);
    }

    const raw = await spawnReadable(ytArgs(track.url, "bestaudio/best"));
    const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vn", "-f", "s16le", "-ar", "48000", "-ac", "2", "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
    // Skipping or stopping kills both processes, which breaks the pipes (EPIPE): swallow those
    // instead of letting them surface as uncaught errors.
    const ignore = () => {};
    ff.on("error", e => Logger.warn(`ffmpeg failed: ${e.message}`, CTX));
    ff.stdin!.on("error", ignore);
    ff.stdout!.on("error", ignore);
    raw.stream.on("error", ignore);
    raw.stream.pipe(ff.stdin!);
    raw.proc.on("close", () => ff.stdin!.end());
    ff.stderr!.on("data", d => Logger.warn(`[ffmpeg] ${d.toString().trim()}`, CTX));
    return { stream: ff.stdout!, proc: raw.proc, ffmpeg: ff, inputType: StreamType.Raw };
}

export function formatDuration(sec: number): string {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i;

/** The YouTube video id in a link, or null. */
export function youtubeIdOf(text: string): string | null {
    return YOUTUBE_ID.exec(text)?.[1] ?? null;
}

const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/** A Spotify track's "Song · Artist", from Spotify's public oEmbed (no account needed), to search YouTube with. */
async function spotifyTitle(url: string): Promise<string | null> {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`).catch(() => null);
    if (!res?.ok) return null;
    const body = await res.json().catch(() => null) as { title?: string } | null;
    return body?.title?.trim() || null;
}

/** Any other link yt-dlp can play (SoundCloud, a direct audio file…): its title and length from yt-dlp itself. */
async function linkTrack(url: string): Promise<Track> {
    const ytdlp = await ensureYtDlp();
    const out = await new Promise<string>((resolve, reject) => {
        const p = spawn(ytdlp, [url, "--dump-single-json", "--no-playlist", "--quiet", "--no-warnings", "--js-runtimes", process.env.YTDLP_JS_RUNTIME || "bun"], { stdio: ["ignore", "pipe", "pipe"] });
        let data = "";
        p.stdout!.on("data", d => { data += d.toString(); });
        p.once("error", reject);
        p.once("close", code => (code === 0 ? resolve(data) : reject(new Error(L("That link can't be played", "لا يمكن تشغيل هذا الرابط")))));
    });
    const info = JSON.parse(out) as { id?: string; webpage_url?: string; title?: string; duration?: number; thumbnail?: string; uploader?: string };
    return {
        id: String(info.id ?? url),
        url: info.webpage_url ?? url,
        title: info.title ?? url,
        durationSeconds: Math.round(info.duration ?? 0),
        thumbnail: info.thumbnail ?? "",
        author: info.uploader ?? "",
    };
}

/**
 * What to play for what someone typed: a song name (searched on YouTube), a YouTube link, a Spotify track link (its
 * name is searched on YouTube, since Spotify audio can't be streamed), or any other link yt-dlp can play.
 * The first result plays; the rest are offered as suggestions.
 */
export async function resolveQuery(query: string, limit: number): Promise<Track[]> {
    const text = query.trim();
    const id = youtubeIdOf(text);
    if (id) {
        const v = await ytSearch({ videoId: id }).catch(() => null);
        if (!v) throw new Error(L("Couldn't open that YouTube link", "تعذّر فتح رابط YouTube"));
        const first: Track = { id, url: `https://www.youtube.com/watch?v=${id}`, title: v.title, durationSeconds: v.seconds || 0, thumbnail: v.thumbnail ?? v.image, author: v.author?.name || "YouTube" };
        const more = await searchVideos(v.title, limit).catch(() => []);
        return [first, ...more.filter(t => t.id !== id)].slice(0, limit);
    }
    if (/open\.spotify\.com\//i.test(text)) {
        const title = await spotifyTitle(text);
        if (!title) throw new Error(L("Couldn't read that Spotify link. Write the song name instead.", "تعذّرت قراءة رابط Spotify. اكتب اسم الأغنية بدلاً منه."));
        return searchVideos(title, limit);
    }
    if (isLink(text)) return [await linkTrack(text)];
    return searchVideos(text, limit);
}

/** Up to `limit` YouTube results for a query. Throws (in the server's language, for the reply) when there are none. */
export async function searchVideos(query: string, limit: number): Promise<Track[]> {
    const result = await ytSearch(query);
    const videos = (result.videos || []).filter(v => v.videoId).slice(0, limit).map(v => ({
        id: v.videoId,
        url: v.url,
        title: v.title,
        durationSeconds: v.seconds || 0,
        thumbnail: v.thumbnail ?? v.image,
        author: v.author?.name || "YouTube",
    }));
    if (!videos.length) throw new Error(L("Couldn't find that song on YouTube", "لم يتم العثور على الأغنية في YouTube"));
    return videos;
}
