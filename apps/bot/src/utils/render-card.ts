import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";

/**
 * A card a server designed on the dashboard: its uploaded image (a transparent PNG works) with round pictures and lines
 * of text placed in the image's own pixels. No uploaded image → no card (there is no built-in background).
 */
export interface CardLayoutDoc {
    background: string | null;
    width: number;
    height: number;
    [piece: string]: unknown;
}

const COLOR = /^#[0-9a-f]{6}$/i;
const FONTS = `"Noto Sans Arabic", "Noto Sans", "Segoe UI", Arial, sans-serif`;
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

async function decode(dataUrl: string | null | undefined): Promise<Image | null> {
    const m = /^data:image\/(?:png|jpeg|webp|gif);base64,(.+)$/.exec(dataUrl ?? "");
    if (!m) return null;
    return loadImage(Buffer.from(m[1]!, "base64")).catch(() => null);
}

function drawText(ctx: SKRSContext2D, text: string, x: number, y: number, size: number, color: string, maxWidth: number): void {
    let px = size;
    ctx.font = `700 ${px}px ${FONTS}`;
    while (ctx.measureText(text).width > maxWidth && px > size * 0.45) {
        px -= 2;
        ctx.font = `700 ${px}px ${FONTS}`;
    }
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y, maxWidth);
}

/** Draws the card, or returns null when the server hasn't uploaded an image for it. */
export async function renderCard(
    layout: CardLayoutDoc | null | undefined,
    content: { pictures: Record<string, Buffer | null>; texts: Record<string, string> },
): Promise<Buffer | null> {
    const base = await decode(layout?.background);
    if (!layout || !base) return null;
    const scale = Math.min(1, 1800 / base.width);
    const k = base.width / (num(layout.width, 1, 100_000) ?? base.width);
    const canvas = createCanvas(Math.round(base.width * scale), Math.round(base.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    for (const [key, buffer] of Object.entries(content.pictures)) {
        const p = layout[key] as { x?: unknown; y?: unknown; r?: unknown } | undefined;
        const x = num(p?.x, 0, layout.width), y = num(p?.y, 0, layout.height), r = num(p?.r, 1, layout.height);
        if (x === null || y === null || r === null) continue;
        const cx = x * k * scale, cy = y * k * scale, cr = r * k * scale;
        const picture = buffer ? await loadImage(buffer).catch(() => null) : null;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (picture) ctx.drawImage(picture, cx - cr, cy - cr, cr * 2, cr * 2);
        else { ctx.fillStyle = "#5865f2"; ctx.fill(); }
        ctx.restore();
    }
    for (const [key, text] of Object.entries(content.texts)) {
        const p = layout[key] as { x?: unknown; y?: unknown; size?: unknown; color?: unknown } | undefined;
        const x = num(p?.x, 0, layout.width), y = num(p?.y, 0, layout.height), size = num(p?.size, 4, layout.height);
        if (x === null || y === null || size === null || !text) continue;
        const color = typeof p?.color === "string" && COLOR.test(p.color) ? p.color : "#ffffff";
        drawText(ctx, text, x * k * scale, y * k * scale, size * k * scale, color, canvas.width * 0.8);
    }
    return canvas.toBuffer("image/png");
}

/** A member's or server's picture as bytes, for a card. */
export async function fetchPicture(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null;
    return fetch(url)
        .then(async response => (response.ok ? Buffer.from(await response.arrayBuffer()) : null))
        .catch(() => null);
}
