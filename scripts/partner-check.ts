/** Verifies the partner feature's banner rendering and Components V2 payloads — no database, no gateway. */
import { readFileSync } from "node:fs";
import { loadImage } from "@napi-rs/canvas";
import { ComponentType, ButtonStyle } from "discord.js";
import { PARTNER_CONFIG } from "@constants";
import { renderPartnerBanner, normalizePartnerImage } from "@bot/features/partner/utils/render-partner-banner";
import { buildPartnerPost, buildPartnerInfo, buildPartnerList, PARTNER_INFO_ID } from "@bot/features/partner/utils/partner-views";
import { partnerFeature } from "@bot/features/partner/partner";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

// Banner.
{
    const stored = await normalizePartnerImage(readFileSync("images/logo.png"));
    const storedImage = await loadImage(stored);
    check("stored partner image is shrunk to at most 512px", Math.max(storedImage.width, storedImage.height) <= PARTNER_CONFIG.storedImageMaxSize);

    const banner = await renderPartnerBanner(stored);
    const rendered = await loadImage(banner);
    const template = await loadImage(readFileSync("images/partner.png"));
    check("banner is the template at the output scale", rendered.width === Math.round(template.width * PARTNER_CONFIG.outputScale), `${rendered.width}px`);
    check("banner stays well under Discord's 10 MB upload limit", banner.length < 8 * 1024 * 1024, `${(banner.length / 1024 / 1024).toFixed(1)} MB`);

    const wide = await normalizePartnerImage(await (async () => {
        const { createCanvas } = await import("@napi-rs/canvas");
        const c = createCanvas(1200, 300);
        return c.toBuffer("image/png");
    })());
    const wideImage = await loadImage(wide);
    check("a wide image keeps its proportions when stored", wideImage.width === 512 && wideImage.height === 128, `${wideImage.width}×${wideImage.height}`);

    let rejected = false;
    try { await normalizePartnerImage(Buffer.from("not an image")); } catch { rejected = true; }
    check("a file that isn't an image is rejected", rejected);
}

// The public post.
{
    const id = "65f0c0ffee0000000000abcd";
    const [container] = buildPartnerPost(id, "Test Server", Buffer.from("png")).components.map(c => c.toJSON()) as any[];
    const [gallery, row] = container.components;
    check("post is one container", container.type === ComponentType.Container);
    check("post shows the banner full width (media gallery)", gallery.type === ComponentType.MediaGallery && gallery.items[0].media.url === "attachment://partner.png");
    check("post has exactly two buttons", row.type === ComponentType.ActionRow && row.components.length === 2);

    const [info, beAPartner] = row.components;
    check("Information is grey with the info emoji", info.style === ButtonStyle.Secondary && info.emoji.id === PARTNER_CONFIG.emojis.info.id && info.label === "| Information");
    check("Be a Partner links to the partner channel", beAPartner.style === ButtonStyle.Link && beAPartner.url === PARTNER_CONFIG.beAPartnerUrl);
    check("Be a Partner uses the robtic emoji", beAPartner.emoji.id === PARTNER_CONFIG.emojis.robtic.id && beAPartner.label === "| Be a Partner");
    check("Information button id matches its handler", PARTNER_INFO_ID.test(info.custom_id));
    check("foreign ids do not match", !PARTNER_INFO_ID.test("partner:info:not-an-id") && !PARTNER_INFO_ID.test("top:nav:1"));
}

// Information panel and list.
{
    const partner = {
        name: "Test", description: "desc", representativeId: "1440413794198360136",
        inviteUrl: "https://discord.gg/abc", image: Buffer.from("png"), guildId: "1", channelId: "2", messageId: "3",
    } as any;
    const info = buildPartnerInfo(partner);
    const [container] = info.components.map(c => c.toJSON()) as any[];
    check("information panel shows the stored image as a thumbnail", container.components[0].accessory.media.url === "attachment://partner-logo.png");
    check("information panel attaches the stored image", info.files.length === 1);

    const many = Array.from({ length: 200 }, (_, i) => ({ ...partner, name: `Server ${i}` }));
    const [list] = buildPartnerList("Robtic", many).components.map(c => c.toJSON()) as any[];
    const chars = list.components.filter((c: any) => c.type === ComponentType.TextDisplay).reduce((n: number, c: any) => n + c.content.length, 0);
    check("a long partner list stays within the 4000-character message limit", chars <= 4000, `${chars}`);
    check("a long partner list says how many were left out", JSON.stringify(list).includes("more."));
}

// Manifest.
{
    const partner = partnerFeature.commands[0]!;
    const subs: string[] = partner.subcommands.map(s => s.name);
    check("/partner has add, list, remove, role, channel", ["add", "list", "remove", "role", "channel"].every(s => subs.includes(s)));
    check("the feature listens for joins (representatives who join later get the role)", (partnerFeature.events as readonly string[] | undefined)?.includes("guildMemberAdd") === true);
    check("/partner needs the Manager staff tier", partner.requiredPermission === 80);
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}

console.log("\nAll partner checks passed.");
