import { join } from "node:path";
import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { LEVEL_CARD_CONFIG } from "@constants";
import type { XpKind } from "@core/xp";
import type { LevelCardLayoutDoc } from "@database/models/XPSettings";

const ROOT = join(import.meta.dir, "../../../../../..");
const FONT_STACK = [LEVEL_CARD_CONFIG.fontFamily, ...LEVEL_CARD_CONFIG.fallbackFonts].map(f => (f.includes(" ") ? `"${f}"` : f)).join(", ");

let template: Promise<Image> | null = null;

/** The template is 11MB of PNG — decoded once, with the font registered alongside, then reused for every card. */
function loadTemplate(): Promise<Image> {
    template ??= (async () => {
        GlobalFonts.registerFromPath(join(ROOT, ...LEVEL_CARD_CONFIG.fontPath), LEVEL_CARD_CONFIG.fontFamily);
        return loadImage(join(ROOT, ...LEVEL_CARD_CONFIG.templatePath));
    })().catch(err => {
        template = null;
        throw err;
    });
    return template;
}

interface TextSlot {
    centerX: number;
    centerY: number;
    fontSize: number;
    color: string;
    maxWidth?: number;
    minFontSize?: number;
}

/**
 * Draws one centred line. A line wider than `maxWidth` is shrunk down to `minFontSize`, then cut
 * with an ellipsis — a long name never runs over the circles on either side.
 */
function drawText(ctx: SKRSContext2D, text: string, slot: TextSlot, scale: number): void {
    const maxWidth = slot.maxWidth ? slot.maxWidth * scale : Infinity;
    const font = (size: number) => `700 ${Math.round(size * scale)}px ${FONT_STACK}`;

    let size = slot.fontSize;
    ctx.font = font(size);
    while (ctx.measureText(text).width > maxWidth && size > (slot.minFontSize ?? size)) {
        size -= 4;
        ctx.font = font(size);
    }

    let line = text;
    while (line.length > 1 && ctx.measureText(line === text ? line : `${line}…`).width > maxWidth) line = line.slice(0, -1);
    if (line !== text) line = `${line.trimEnd()}…`;

    ctx.fillStyle = slot.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(line, slot.centerX * scale, slot.centerY * scale);
}

export interface LevelCardInput {
    /** The member's avatar image; `null` leaves the circle empty. */
    avatar: Buffer | null;
    name: string;
    kind: XpKind;
    level: number;
    /** The server's own layout (dashboard). Without it, the built-in card and LEVEL_CARD_CONFIG positions. */
    layout?: LevelCardLayoutDoc | null;
}

const COLOR = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback);

/** A stored layout → the slots the drawing code uses, every value checked (bad ones fall back to the defaults). */
function slotsFor(layout: LevelCardLayoutDoc | null | undefined, width: number, height: number) {
    const d = LEVEL_CARD_CONFIG;
    if (!layout) return { avatar: d.avatar, name: d.name, kind: d.kind, level: d.level };
    const text = (t: LevelCardLayoutDoc["name"] | undefined, fallback: TextSlot, maxWidth?: number): TextSlot => ({
        centerX: num(t?.x, 0, width, fallback.centerX),
        centerY: num(t?.y, 0, height, fallback.centerY),
        fontSize: num(t?.size, 4, height, fallback.fontSize),
        minFontSize: Math.round(num(t?.size, 4, height, fallback.fontSize) * 0.45),
        color: t && COLOR.test(t.color) ? t.color : fallback.color,
        maxWidth,
    });
    return {
        avatar: { centerX: num(layout.avatar?.x, 0, width, d.avatar.centerX), centerY: num(layout.avatar?.y, 0, height, d.avatar.centerY), radius: num(layout.avatar?.r, 4, height, d.avatar.radius) },
        name: text(layout.name, d.name, width * 0.22),
        kind: text(layout.kind, d.kind),
        level: text(layout.level, d.level, num(layout.level?.size, 4, height, d.level.fontSize) * 2),
    };
}

/** An uploaded background (data URL) decoded, or null when it isn't one. */
async function loadBackground(dataUrl: string | null | undefined): Promise<Image | null> {
    const m = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/.exec(dataUrl ?? "");
    if (!m) return null;
    return loadImage(Buffer.from(m[1]!, "base64")).catch(() => null);
}

/**
 * The level-up card: the template with the member's avatar in the left circle, their name and the
 * level type in the middle, and the level they reached in the right circle. Returns a JPEG.
 */
export async function renderLevelCard({ avatar, name, kind, level, layout }: LevelCardInput): Promise<Buffer> {
    const custom = await loadBackground(layout?.background);
    const [base, picture] = await Promise.all([custom ?? loadTemplate(), avatar ? loadImage(avatar).catch(() => null) : null]);
    const slots = slotsFor(layout, base.width, base.height);

    // The built-in template is huge and posted at 40 %; an uploaded background is already web-sized.
    const scale = custom ? Math.min(1, 1800 / base.width) : LEVEL_CARD_CONFIG.outputScale;
    const canvas = createCanvas(Math.round(base.width * scale), Math.round(base.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    if (picture) {
        const { centerX, centerY, radius } = slots.avatar;
        const r = radius * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX * scale, centerY * scale, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(picture, centerX * scale - r, centerY * scale - r, r * 2, r * 2);
        ctx.restore();
    }

    drawText(ctx, name.trim() || "Member", slots.name, scale);
    drawText(ctx, LEVEL_CARD_CONFIG.kindLabels[kind], slots.kind, scale);
    drawText(ctx, String(level), slots.level, scale);

    return canvas.toBuffer("image/jpeg", LEVEL_CARD_CONFIG.jpegQuality);
}
