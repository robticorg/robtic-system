/** Verifies the level-up card renders (size, format, long and Arabic names) — no database, no gateway. Pass a folder to keep the images. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadImage } from "@napi-rs/canvas";
import { LEVEL_CARD_CONFIG } from "@constants";
import { renderLevelCard } from "@bot/services/community/xp/render-level-card";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const outDir = process.argv[2];
const keep = (file: string, card: Buffer) => { if (outDir) writeFileSync(join(outDir, file), card); };

const avatar = readFileSync("images/logo.png");
const template = await loadImage(readFileSync("images/level.png"));

const card = await renderLevelCard({ avatar, name: "Steve", kind: "message", level: 12 });
keep("level-message.jpg", card);
const rendered = await loadImage(card);
check("card is the template at the output scale", rendered.width === Math.round(template.width * LEVEL_CARD_CONFIG.outputScale), `${rendered.width}×${rendered.height}`);
check("card is a JPEG", card[0] === 0xff && card[1] === 0xd8);
check("card is small enough to post on every level-up", card.length < 1024 * 1024, `${(card.length / 1024).toFixed(0)} KB`);

const voice = await renderLevelCard({ avatar, name: "A very long display name that cannot fit", kind: "voice", level: 100 });
keep("level-voice-long.jpg", voice);
check("a long name and a three-digit level still render", voice.length > 0 && !voice.equals(card));

const arabic = await renderLevelCard({ avatar: null, name: "روبتك", kind: "voice", level: 7 });
keep("level-arabic-no-avatar.jpg", arabic);
check("an Arabic name with no avatar renders", arabic.length > 0);

const broken = await renderLevelCard({ avatar: Buffer.from("not an image"), name: "Steve", kind: "message", level: 1 });
check("an avatar that can't be decoded leaves the circle empty instead of failing", broken.length > 0);

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll level card checks passed.");
process.exit(0);
