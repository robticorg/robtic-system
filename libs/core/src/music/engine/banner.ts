import { AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { MUSIC_CONFIG } from "@constants";
import { Logger } from "@logger";
import { formatDuration, type Track } from "./youtube";

export interface BannerState {
    track: Track;
    elapsedSeconds: number;
    volume: number;
    thumbFileName: string;
}

/** The now-playing banner (blurred cover, title, progress bar, volume, branding) and a square thumbnail. */
export async function generateBanner(state: BannerState): Promise<{ banner: AttachmentBuilder; thumb: AttachmentBuilder | null }> {
    const { track, elapsedSeconds, volume } = state;
    const canvas = createCanvas(900, 330);
    const ctx = canvas.getContext("2d");

    try {
        const cover = await loadImage(track.thumbnail);

        ctx.save();
        ctx.filter = "blur(18px) brightness(0.35)";
        ctx.drawImage(cover, -30, -30, 960, 390);
        ctx.restore();

        ctx.fillStyle = "rgba(10, 10, 14, 0.42)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(cover, 35, 35, 105, 105);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(35, 35, 105, 105);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 27px Arial";
        ctx.fillText(String(track.title || "Unknown").slice(0, 70), 165, 72);

        ctx.fillStyle = "#c7c7cc";
        ctx.font = "18px Arial";
        ctx.fillText(String(track.author || "YouTube").slice(0, 55), 165, 105);

        const ratio = track.durationSeconds ? Math.max(0, Math.min(1, elapsedSeconds / track.durationSeconds)) : 0;
        const x = 165, y = 225, width = 665, height = 7;
        const filled = Math.round(width * ratio);

        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 4);
        ctx.fill();

        ctx.fillStyle = "#f1c40f";
        ctx.beginPath();
        ctx.roundRect(x, y, filled, height, 4);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + filled, y + height / 2, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 16px Arial";
        ctx.fillText(formatDuration(Math.min(elapsedSeconds, track.durationSeconds)), x, y + 40);
        const total = formatDuration(track.durationSeconds);
        ctx.fillText(total, x + width - ctx.measureText(total).width, y + 40);

        ctx.fillStyle = "#eeeeee";
        ctx.font = "15px Arial";
        ctx.fillText(`🔊 ${volume}%`, 35, 285);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px Arial";
        ctx.fillText(MUSIC_CONFIG.bannerTitle, canvas.width / 2, 295);
        ctx.fillStyle = "#c7c7cc";
        ctx.font = "14px Arial";
        ctx.fillText(MUSIC_CONFIG.bannerSubtitle, canvas.width / 2, 317);
        ctx.textAlign = "left";

        const thumbCanvas = createCanvas(160, 160);
        const thumbCtx = thumbCanvas.getContext("2d");
        thumbCtx.fillStyle = "#111111";
        thumbCtx.fillRect(0, 0, 160, 160);
        thumbCtx.drawImage(cover, 0, 0, 160, 160);

        return {
            banner: new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "banner.png" }),
            thumb: new AttachmentBuilder(thumbCanvas.toBuffer("image/png"), { name: state.thumbFileName }),
        };
    } catch (error) {
        Logger.warn(`Banner error: ${(error as Error).message}`, "music");
        ctx.fillStyle = "#2f3136";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return { banner: new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "banner.png" }), thumb: null };
    }
}
