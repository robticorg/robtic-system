/**
 * Info panels and /send: every form and both panel layouts build without Discord's builders
 * rejecting them, and emoji input is validated.
 *
 *   bun --preload ./libs/shared/src/preload.ts scripts/info-check.ts
 */
import { Types } from "mongoose";
import { ComponentType } from "discord.js";
import { buildInfoOptionModal, buildInfoPanelModal, normalizeEmoji } from "@bot/features/info/utils/info-form";
import { buildInfoPanelMessage, buildInfoReply, INFO_BUTTON_ID, INFO_MENU_ID } from "@bot/features/info/utils/info-render";
import sendCommand from "@bot/commands/guild/admin/send.command";
import commands from "@bot/features/info/info.command";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};
const attempt = (fn: () => unknown) => { try { fn(); return ""; } catch (e) { return String(e); } };

const id = new Types.ObjectId();
const option = (n: number, style = "primary") => ({ optionId: n.toString(16).padStart(8, "0"), label: `Option ${n}`, reply: `Answer ${n}`, menuDescription: n % 2 ? "line" : null, emoji: n % 3 ? "📌" : null, style });
const panel = (type: "buttons" | "menu", count: number, image = false) => ({
    _id: id, guildId: "1", channelId: "2", messageId: null, description: "Hello **world**", type,
    image: image ? Buffer.from("x") : null, imageName: image ? "info-image.png" : null,
    options: Array.from({ length: count }, (_, i) => option(i + 1, ["primary", "secondary", "success", "danger"][i % 4])),
}) as any;

check("create form builds", attempt(() => buildInfoPanelModal().toJSON()) === "");
const upd = buildInfoPanelModal(panel("menu", 0, true)).toJSON();
check("update form (with image) has the remove-image checkbox", upd.components.length === 5);
check("update form without image has 4 fields", buildInfoPanelModal(panel("buttons", 0)).toJSON().components.length === 4);
check("option form builds with 5 fields", buildInfoOptionModal(panel("buttons", 0)).toJSON().components.length === 5);

for (const type of ["buttons", "menu"] as const) {
    for (const count of [0, 1, 7, 25]) {
        const err = attempt(() => JSON.stringify(buildInfoPanelMessage(panel(type, count, count === 7)).components.map(c => c.toJSON())));
        check(`${type} panel with ${count} options builds`, err === "", err);
    }
}
const buttons = buildInfoPanelMessage(panel("buttons", 25)).components[0]!.toJSON() as any;
const rows = buttons.components.filter((c: any) => c.type === ComponentType.ActionRow);
check("25 buttons go in 5 rows of 5", rows.length === 5 && rows.every((r: any) => r.components.length === 5));
check("button ids match the click handler", INFO_BUTTON_ID.test(rows[0].components[0].custom_id), rows[0].components[0].custom_id);
const menu = (buildInfoPanelMessage(panel("menu", 3)).components[0]!.toJSON() as any).components.find((c: any) => c.type === ComponentType.ActionRow).components[0];
check("menu id matches the pick handler", INFO_MENU_ID.test(menu.custom_id), menu.custom_id);
check("an image is attached and shown", buildInfoPanelMessage(panel("buttons", 1, true)).files.length === 1);
check("a click answer builds", attempt(() => buildInfoReply(option(1) as any).components[0]!.toJSON()) === "");

for (const [input, ok] of [["📌", true], ["🇸🇦", true], ["<:robtic:123456789012345678>", true], ["<a:spin:123456789012345678>", true], ["hello", false], ["📌 x", false], [":smile:", false]] as const) {
    check(`emoji ${JSON.stringify(input)} ${ok ? "accepted" : "refused"}`, (normalizeEmoji(input) !== null) === ok);
}

const send = sendCommand.data.toJSON();
check("/send takes no options (the form asks)", !send.options?.length);
const names = commands.map(c => (c.data as any).toJSON());
check("/info has create, update, delete", names.find(c => c.name === "info")?.options.map((o: any) => o.name).join() === "create,update,delete");
check("/option has add, remove", names.find(c => c.name === "option")?.options.map((o: any) => o.name).join() === "add,remove");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
