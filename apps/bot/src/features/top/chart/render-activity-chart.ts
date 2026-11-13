import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import type { ActivitySeries } from "./activity-series";

/**
 * The picture under `/top`: the server's own background (set on the dashboard, Leaderboards), darkened, with the
 * period's title, two figures (messages, change from the period before) and a glowing line of messages over time.
 * Without a background it draws on a dark gradient.
 */

const W = 1200;
const H = 470;
const FONTS = `"Noto Sans Arabic", "Noto Sans", "Segoe UI", Arial, sans-serif`;
const CHART = { left: 90, right: W - 50, top: 175, bottom: H - 55 };

export interface ChartText {
    title: string;
    totalLabel: string;
    changeLabel: string | null;
    rtl: boolean;
}

function cover(ctx: SKRSContext2D, img: Image): void {
    const scale = Math.max(W / img.width, H / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/** A figure in a rounded box: a round badge with an arrow, a small label and the number. */
function chip(ctx: SKRSContext2D, x: number, y: number, label: string, value: string, up: boolean, accent: string, rtl: boolean): void {
    const w = 260, h = 64;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = "rgba(18, 10, 12, 0.78)";
    ctx.fill();
    ctx.strokeStyle = `${accent}88`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const bx = rtl ? x + w - 34 : x + 34, by = y + h / 2;
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.fillStyle = `${accent}33`;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by + (up ? 8 : -8));
    ctx.lineTo(bx, by + (up ? -8 : 8));
    ctx.moveTo(bx - 6, by + (up ? -2 : 2));
    ctx.lineTo(bx, by + (up ? -8 : 8));
    ctx.lineTo(bx + 6, by + (up ? -2 : 2));
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const tx = rtl ? x + w - 64 : x + 64;
    ctx.textAlign = rtl ? "right" : "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#b9b4b6";
    ctx.font = `500 15px ${FONTS}`;
    ctx.fillText(label, tx, y + 26, w - 80);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 22px ${FONTS}`;
    // Numbers read left to right in Arabic too: without the mark, "-530" comes out as "530-".
    ctx.fillText(rtl ? `⁦${value}⁩` : value, tx, y + 52, w - 80);
}

/** A smooth line through the points (Catmull-Rom as Bézier curves). */
function smoothLine(ctx: SKRSContext2D, pts: Array<[number, number]>): void {
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
        ctx.bezierCurveTo(
            p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1],
        );
    }
}

const niceMax = (v: number) => {
    if (v <= 4) return 4;
    const pow = 10 ** Math.floor(Math.log10(v));
    return Math.ceil(v / (pow / 2)) * (pow / 2);
};

export async function renderActivityChart(series: ActivitySeries, text: ChartText, accent: string, background: Buffer | null): Promise<Buffer> {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = background ? await loadImage(background).catch(() => null) : null;
    if (bg) cover(ctx, bg);
    else {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, "#1c0b0e");
        g.addColorStop(1, "#08080b");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, W, H);

    ctx.direction = text.rtl ? "rtl" : "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 30px ${FONTS}`;
    ctx.fillText(text.title, W / 2, 50, W - 80);

    const fmt = (n: number) => n.toLocaleString("en-US");
    const chips: Array<[string, string, boolean]> = [[text.totalLabel, fmt(series.total), true]];
    if (text.changeLabel && series.change !== null) chips.push([text.changeLabel, `${series.change > 0 ? "+" : ""}${fmt(series.change)}`, series.change >= 0]);
    if (text.rtl) chips.reverse();
    const gap = 40, cw = 260, startX = (W - (chips.length * cw + (chips.length - 1) * gap)) / 2;
    chips.forEach(([label, value, up], i) => chip(ctx, startX + i * (cw + gap), 78, label, value, up, accent, text.rtl));

    // The axes run left to right in both languages, like a clock does.
    ctx.direction = "ltr";
    const max = niceMax(Math.max(...series.points, 0));
    const x = (i: number) => CHART.left + (series.points.length <= 1 ? 0 : (i / (series.points.length - 1)) * (CHART.right - CHART.left));
    const y = (v: number) => CHART.bottom - (v / max) * (CHART.bottom - CHART.top);

    ctx.font = `500 14px ${FONTS}`;
    ctx.fillStyle = "#a9a3a5";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 3; i++) {
        const v = (max / 3) * i;
        ctx.fillText(fmt(Math.round(v)), CHART.left - 14, y(v));
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CHART.left, y(v));
        ctx.lineTo(CHART.right, y(v));
        ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    series.labels.forEach((label, i) => { if (label) ctx.fillText(label, x(i), CHART.bottom + 16); });

    const pts = series.points.map((v, i): [number, number] => [x(i), y(v)]);
    if (pts.length > 1) {
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        // A smooth curve overshoots after a sharp drop; keep it inside the chart so it never dips below zero.
        ctx.beginPath();
        ctx.rect(CHART.left - 6, CHART.top - 30, CHART.right - CHART.left + 12, CHART.bottom - CHART.top + 32);
        ctx.clip();
        smoothLine(ctx, pts);
        ctx.stroke();
        ctx.restore();
    }

    return canvas.toBuffer("image/png");
}
