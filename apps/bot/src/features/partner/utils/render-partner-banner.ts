import { join } from "node:path";
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { PARTNER_CONFIG } from "@constants";

const ROOT = join(import.meta.dir, "../../../../../..");

let template: Promise<Image> | null = null;

/** The template is 8MB of PNG — decoded once, then reused for every banner. */
function loadTemplate(): Promise<Image> {
    template ??= loadImage(join(ROOT, ...PARTNER_CONFIG.templatePath)).catch(err => {
        template = null;
        throw err;
    });
    return template;
}

function roundedRect(ctx: CanvasRenderingContext2D | import("@napi-rs/canvas").SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/**
 * The partner banner: the template (our logo on the left) with the partner's image fitted into
 * the right panel. Returns a PNG.
 */
export async function renderPartnerBanner(partnerImage: Buffer): Promise<Buffer> {
    const [base, partner] = await Promise.all([loadTemplate(), loadImage(partnerImage)]);

    const scale = PARTNER_CONFIG.outputScale;
    const canvas = createCanvas(Math.round(base.width * scale), Math.round(base.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    const { centerX, centerY, size, cornerRadius } = PARTNER_CONFIG.slot;
    const fit = Math.min(size / partner.width, size / partner.height);
    const w = partner.width * fit * scale;
    const h = partner.height * fit * scale;
    const x = centerX * scale - w / 2;
    const y = centerY * scale - h / 2;

    ctx.save();
    roundedRect(ctx, x, y, w, h, cornerRadius * scale);
    ctx.clip();
    ctx.drawImage(partner, x, y, w, h);
    ctx.restore();

    return canvas.toBuffer("image/png");
}

/** Shrinks an uploaded image to at most `storedImageMaxSize` on its long side, as PNG, for storage. */
export async function normalizePartnerImage(upload: Buffer): Promise<Buffer> {
    const image = await loadImage(upload);
    const max = PARTNER_CONFIG.storedImageMaxSize;
    const fit = Math.min(1, max / Math.max(image.width, image.height));

    const canvas = createCanvas(Math.max(1, Math.round(image.width * fit)), Math.max(1, Math.round(image.height * fit)));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toBuffer("image/png");
}
