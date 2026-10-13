import { join } from "node:path";
import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { LEVEL_CARD_CONFIG } from "@constants";
import type { XpKind } from "@core/xp";

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
}

/**
 * The level-up card: the template with the member's avatar in the left circle, their name and the
 * level type in the middle, and the level they reached in the right circle. Returns a JPEG.
 */
export async function renderLevelCard({ avatar, name, kind, level }: LevelCardInput): Promise<Buffer> {
    const [base, picture] = await Promise.all([loadTemplate(), avatar ? loadImage(avatar).catch(() => null) : null]);

    const scale = LEVEL_CARD_CONFIG.outputScale;
    const canvas = createCanvas(Math.round(base.width * scale), Math.round(base.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    if (picture) {
        const { centerX, centerY, radius } = LEVEL_CARD_CONFIG.avatar;
        const r = radius * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX * scale, centerY * scale, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(picture, centerX * scale - r, centerY * scale - r, r * 2, r * 2);
        ctx.restore();
    }

    drawText(ctx, name.trim() || "Member", LEVEL_CARD_CONFIG.name, scale);
    drawText(ctx, LEVEL_CARD_CONFIG.kindLabels[kind], LEVEL_CARD_CONFIG.kind, scale);
    drawText(ctx, String(level), LEVEL_CARD_CONFIG.level, scale);

    return canvas.toBuffer("image/jpeg", LEVEL_CARD_CONFIG.jpegQuality);
}
