/** Verifies the boost thank-you wording, layout, 30-minute batching and manifest — no database, no gateway. */
import { ComponentType } from "discord.js";
import { BOOST_CONFIG } from "@constants";
import { boostThanksMessage, buildBoostThanks } from "@bot/features/boost/utils/boost-message";
import { createBoostBatcher, type BatchTimers } from "@bot/features/boost/utils/boost-batcher";
import { boostFeature } from "@bot/features/boost/boost";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

// Wording.
{
    const emoji = "<:CrystalSub:123456789012345678>";
    const [mentions, arabic, english] = boostThanksMessage(["1", "2", "3"], emoji).split("\n");
    check("every booster on the first line, comma separated", mentions === "<@1>, <@2>, <@3>", mentions);
    check("Arabic line is bold and ends with the emoji",
        arabic === `**شكراً لدعمك لروبيتك وتعزيزك للسيرفر، دعمك يعني لنا الكثير ويساعدنا على الاستمرار والتطور ${emoji}**`, arabic);
    check("English line is small text and ends with the emoji",
        english === `-# Thank you for supporting Robtic and boosting the server, your support means a lot and helps us keep growing ${emoji}`, english);
    check("a single booster has no stray comma", boostThanksMessage(["42"], emoji).startsWith("<@42>\n"));

    const bare = boostThanksMessage(["42"], "");
    check("without the emoji there is no trailing space", !/ \*\*$/.test(bare.split("\n")[1]!) && !bare.endsWith(" "));
}

// Layout: only the text, then the line full width. No server icon, no section, no container.
{
    const line = { data: Buffer.from("png"), name: "line.webp" };
    const msg = buildBoostThanks(["1", "2"], "", line);
    const [text, gallery] = msg.components.map(c => c.toJSON()) as any[];
    check("first the thank-you as plain text", text.type === ComponentType.TextDisplay && text.content.startsWith("<@1>, <@2>"));
    check("no server icon or anything beside the text", msg.components.every(c => ![ComponentType.Section, ComponentType.Thumbnail].includes((c.toJSON() as any).type)));
    check("then the line image, full width, under its own file name", gallery.type === ComponentType.MediaGallery && gallery.items[0].media.url === "attachment://line.webp");
    check("exactly two parts: text and line", msg.components.length === 2);
    check("the line image is attached", msg.files.length === 1);
    check("no container (not an embed-style card)", msg.components.every(c => (c.toJSON() as any).type !== ComponentType.Container));

    const noLine = buildBoostThanks(["1"], "", null);
    check("without a line image the thanks still goes out", noLine.components.length === 1 && noLine.files.length === 0);
}

// Batching: 30 quiet minutes, reset by every boost, each member once.
{
    let clock = 0;
    let nextId = 0;
    const scheduled = new Map<number, { at: number; fn: () => void }>();
    const timers: BatchTimers = {
        setTimeout: (fn, ms) => { const id = ++nextId; scheduled.set(id, { at: clock + ms, fn }); return id as never; },
        clearTimeout: id => void scheduled.delete(id as unknown as number),
    };
    const advance = (ms: number) => {
        clock += ms;
        for (const [id, t] of [...scheduled]) if (t.at <= clock) { scheduled.delete(id); t.fn(); }
    };

    const sent: string[][] = [];
    const batcher = createBoostBatcher<string>(BOOST_CONFIG.batchQuietMs, (_g, ids) => sent.push(ids), timers);
    const MIN = 60_000;

    check("the wait is 30 minutes", BOOST_CONFIG.batchQuietMs === 30 * MIN);

    batcher.add("g", "g", "A");
    advance(20 * MIN);
    check("nothing is sent before 30 quiet minutes", sent.length === 0);

    batcher.add("g", "g", "B");           // resets the wait
    advance(20 * MIN);                    // 40 min after A, 20 after B
    check("a new boost restarts the 30 minutes", sent.length === 0);

    batcher.add("g", "g", "A");           // A boosts again — not listed twice
    batcher.add("g", "g", "C");
    check("a member who boosts twice is listed once", batcher.pending("g").join() === "A,B,C");
    check("only one timer is ever waiting per guild", scheduled.size === 1);

    advance(29 * MIN);
    check("still waiting at 29 quiet minutes", sent.length === 0);
    advance(1 * MIN);
    check("after 30 quiet minutes everyone is thanked together", sent.length === 1 && sent[0]!.join() === "A,B,C", JSON.stringify(sent));
    check("the batch is cleared afterwards", batcher.pending("g").length === 0);

    batcher.add("g", "g", "D");
    batcher.add("other", "other", "E");
    advance(30 * MIN);
    check("a new batch starts fresh; guilds are batched separately", sent.length === 3 && sent.some(s => s.join() === "D") && sent.some(s => s.join() === "E"));
}

// Manifest.
{
    const command = boostFeature.commands[0];
    check("/boost channel exists", command.name === "boost" && command.subcommands.some(s => s.name === "channel"));
    check("/boost is admin-only", command.access === "admin");
    check("the channel is optional, so it can be cleared", command.subcommands[0].options.every(o => !("required" in o) || !o.required));
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}

console.log("\nAll boost checks passed.");
