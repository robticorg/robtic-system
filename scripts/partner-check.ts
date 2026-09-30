/** Verifies the partner feature's banner rendering and Components V2 payloads — no database, no gateway. */
import { readFileSync } from "node:fs";
import { loadImage } from "@napi-rs/canvas";
import { ComponentType, ButtonStyle } from "discord.js";
import { PARTNER_CONFIG } from "@constants";
import { renderPartnerBanner, normalizePartnerImage } from "@bot/features/partner/utils/render-partner-banner";
import { buildPartnerPost, buildPartnerInfo, buildPartnerList, PARTNER_INFO_ID } from "@bot/features/partner/utils/partner-views";
import { buildPartnerModal, PARTNER_ADD_MODAL_ID, PARTNER_EDIT_MODAL_ID } from "@bot/features/partner/utils/partner-form";
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
    const components = buildPartnerPost(id, "Test Server", Buffer.from("png")).components.map(c => c.toJSON()) as any[];
    const [gallery, infoSection, joinSection] = components;
    check("post has no container (no embed-style card)", components.every(c => c.type !== ComponentType.Container));
    check("post shows the banner full width (media gallery)", gallery.type === ComponentType.MediaGallery && gallery.items[0].media.url === "attachment://partner.png");
    check("post is the banner then two sections", components.length === 3 && infoSection.type === ComponentType.Section && joinSection.type === ComponentType.Section);
    check("each section carries text beside its button", [infoSection, joinSection].every(s => s.components.length > 0 && s.accessory.type === ComponentType.Button));
    check("the section names the partner", infoSection.components[0].content.includes("Test Server"));

    const [info, beAPartner] = [infoSection.accessory, joinSection.accessory];
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
    const [about, , contact] = info.components.map(c => c.toJSON()) as any[];
    check("information panel shows the stored image as a thumbnail", about.type === ComponentType.Section && about.accessory.media.url === "attachment://partner-logo.png");
    check("information panel attaches the stored image", info.files.length === 1);
    check("Join Server sits beside the representative", contact.type === ComponentType.Section && contact.accessory.style === ButtonStyle.Link && contact.accessory.url === partner.inviteUrl);

    const many = Array.from({ length: 200 }, (_, i) => ({ ...partner, name: `Server ${i}` }));
    const list = buildPartnerList("Robtic", many).components.map(c => c.toJSON()) as any[];
    check("the list has no container either", list.every(c => c.type !== ComponentType.Container));
    const chars = list.filter((c: any) => c.type === ComponentType.TextDisplay).reduce((n: number, c: any) => n + c.content.length, 0);
    check("a long partner list stays within the 4000-character message limit", chars <= 4000, `${chars}`);
    check("a long partner list says how many were left out", JSON.stringify(list).includes("more."));
}

// The add and edit forms.
{
    const partner = {
        _id: "65f0c0ffee0000000000abcd", name: "Test", description: "desc", representativeId: "1440413794198360136",
        inviteUrl: "https://discord.gg/abc",
    } as any;
    const addForm = buildPartnerModal().toJSON() as any;
    const editForm = buildPartnerModal(partner).toJSON() as any;
    const inputs = (form: any) => form.components.map((label: any) => label.component);

    check("the add form uses the add id", addForm.custom_id === PARTNER_ADD_MODAL_ID);
    check("the edit form id matches its handler", PARTNER_EDIT_MODAL_ID.test(editForm.custom_id) && editForm.custom_id.endsWith(partner._id));
    check("the add form starts empty", inputs(addForm).every((c: any) => !c.value));
    check("the edit form is prefilled with the current values",
        ["https://discord.gg/abc", "Test", "1440413794198360136", "desc"].every((v, i) => inputs(editForm)[i].value === v));
    check("the add form requires an image", inputs(addForm)[4].required === true);
    check("the edit form keeps the current logo unless a new one is uploaded", inputs(editForm)[4].required === false && inputs(editForm)[4].min_values === 0);
}

// Manifest.
{
    const partner = partnerFeature.commands[0]!;
    const subs: string[] = partner.subcommands.map(s => s.name);
    check("/partner has add, edit, update, list, remove, role, channel", ["add", "edit", "update", "list", "remove", "role", "channel"].every(s => subs.includes(s)));
    check("the feature listens for joins (representatives who join later get the role)", (partnerFeature.events as readonly string[] | undefined)?.includes("guildMemberAdd") === true);
    check("/partner needs the Manager staff tier", partner.requiredPermission === 80);
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}

console.log("\nAll partner checks passed.");
